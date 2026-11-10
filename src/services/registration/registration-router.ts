import { StatusCode } from "status-code-enum";
import { Router } from "express";

import Config, { Templates } from "../../common/config";

import Models from "../../common/models";
import {
    RegistrationAlreadySubmittedError,
    RegistrationAlreadySubmittedErrorSchema,
    RegistrationApplicationSubmitted,
    RegistrationApplicationDraft,
    RegistrationApplicationDraftRequestSchema,
    RegistrationApplicationSubmittedRequestSchema,
    RegistrationApplicationDraftSchema,
    RegistrationChallenge,
    RegistrationChallengeStatusSchema,
    RegistrationChallengeWorldSchema,
    RegistrationChallengeInvalidPlanError,
    RegistrationChallengeInvalidPlanErrorId,
    RegistrationChallengeInvalidPlanErrorSchema,
    RegistrationChallengeNoFileError,
    RegistrationChallengeNoFileErrorSchema,
    RegistrationChallengeNotFoundError,
    RegistrationChallengeNotFoundErrorSchema,
    RegistrationClosedError,
    RegistrationClosedErrorSchema,
    RegistrationNotFoundError,
    RegistrationNotFoundErrorSchema,
    RegistrationStatusSchema,
    RegistrationMissingProErrorSchema,
    RegistrationMissingProError,
} from "./registration-schemas";
import { DecisionStatus } from "../admission/admission-schemas";

import { getAuthenticatedUser } from "../../common/auth";
import { Role } from "../auth/auth-schemas";

import { sendMail } from "../mail/mail-lib";
import { isRegistrationAlive } from "./registration-lib";
import specification, { Tag } from "../../middleware/specification";
import { z } from "zod";
import { UserIdSchema } from "../../common/schemas";
import { assignInstance, getWorldFile, normalizeScore, toChallengeStatus, toStoredReport } from "./challenge-lib";
import { gradePlan } from "./saloon/saloon-grader";
import { GradeReport, InvalidPlanError, parsePlan } from "./saloon/saloon-schemas";
import { singleJsonFile } from "../../middleware/json-upload";

const registrationRouter = Router();

registrationRouter.get(
    "/status/",
    specification({
        method: "get",
        path: "/registration/status/",
        tag: Tag.REGISTRATION,
        role: null,
        summary: "Gets the status of whether registration is currently active",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The registration status",
                schema: RegistrationStatusSchema,
            },
        },
    }),
    async (_req, res) => {
        const alive = isRegistrationAlive();
        return res.status(StatusCode.SuccessOK).send({ alive });
    },
);

registrationRouter.get(
    "/",
    specification({
        method: "get",
        path: "/registration/",
        tag: Tag.REGISTRATION,
        role: Role.USER,
        summary: "Gets the currently authenticated user's submitted registration data",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The submitted registration information",
                schema: RegistrationApplicationDraftSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Couldn't find submitted registration information (make sure you create it first!)",
                schema: RegistrationNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);

        const registrationData = await Models.RegistrationApplicationSubmitted.findOne({ userId });
        if (!registrationData) {
            return res.status(StatusCode.ClientErrorNotFound).send(RegistrationNotFoundError);
        }

        return res.status(StatusCode.SuccessOK).send(registrationData);
    },
);

registrationRouter.get(
    "/draft/",
    specification({
        method: "get",
        path: "/registration/draft/",
        tag: Tag.REGISTRATION,
        role: Role.USER,
        summary: "Gets the currently authenticated user's draft registration data",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The draft registration information",
                schema: RegistrationApplicationDraftSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Couldn't find draft registration information (make sure you create it first!)",
                schema: RegistrationNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);

        const registrationData = await Models.RegistrationApplicationDraft.findOne({ userId });
        if (!registrationData) {
            return res.status(StatusCode.ClientErrorNotFound).send(RegistrationNotFoundError);
        }

        return res.status(StatusCode.SuccessOK).send(registrationData);
    },
);

registrationRouter.get(
    "/userid/:id/",
    specification({
        method: "get",
        path: "/registration/userid/{id}",
        tag: Tag.REGISTRATION,
        role: Role.STAFF,
        summary: "Gets the specified user's registration data",
        description:
            "Staff-only because this can be used to get any user's registration data.\n" +
            "If you need the currently authenticated user's registration data, use `GET /registration/` instead.",
        parameters: z.object({
            id: UserIdSchema,
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The registration information",
                schema: RegistrationApplicationDraftSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Couldn't find registration information (make sure you create it first!)",
                schema: RegistrationNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = req.params;

        let registrationData = await Models.RegistrationApplicationSubmitted.findOne({ userId });
        if (!registrationData) {
            registrationData = await Models.RegistrationApplicationDraft.findOne({ userId });
        }
        if (!registrationData) {
            return res.status(StatusCode.ClientErrorNotFound).send(RegistrationNotFoundError);
        }

        return res.status(StatusCode.SuccessOK).send(registrationData);
    },
);

registrationRouter.get(
    "/all/:type/",
    specification({
        method: "get",
        path: "/registration/all/{type}",
        tag: Tag.REGISTRATION,
        role: Role.STAFF,
        summary: "Gets all submitted or draft registrations",
        parameters: z.object({
            type: z.enum(["submitted", "draft"]),
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "All registrations of the specified type",
                schema: z.array(RegistrationApplicationDraftSchema),
            },
        },
    }),
    async (req, res) => {
        const { type } = req.params;

        const registrations =
            type === "submitted"
                ? await Models.RegistrationApplicationSubmitted.find()
                : await Models.RegistrationApplicationDraft.find();

        return res.status(StatusCode.SuccessOK).send(registrations);
    },
);

registrationRouter.put(
    "/draft/",
    specification({
        method: "put",
        path: "/registration/draft/",
        tag: Tag.REGISTRATION,
        role: Role.USER,
        summary: "Creates or updates the currently authenticated user's draft registration data",
        body: RegistrationApplicationDraftRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The registration draft was created or updated",
                schema: RegistrationApplicationDraftRequestSchema,
            },
            [StatusCode.ClientErrorForbidden]: {
                description: "Registration is closed",
                schema: RegistrationClosedErrorSchema,
            },
            [StatusCode.ClientErrorBadRequest]: {
                description: "Registration is already submitted, cannot update anymore",
                schema: RegistrationAlreadySubmittedErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);

        if (!isRegistrationAlive()) {
            return res.status(StatusCode.ClientErrorForbidden).send(RegistrationClosedError);
        }

        const setRequest = req.body;

        const isSubmitted = await Models.RegistrationApplicationSubmitted.findOne({ userId: userId });

        if (isSubmitted) {
            return res.status(StatusCode.ClientErrorBadRequest).send(RegistrationAlreadySubmittedError);
        }

        const registrationData: RegistrationApplicationDraft = {
            ...setRequest,
            userId,
        } as RegistrationApplicationDraft;

        const newRegistrationInfo = await Models.RegistrationApplicationDraft.findOneAndUpdate({ userId }, registrationData, {
            upsert: true,
            new: true,
        });

        if (!newRegistrationInfo) {
            throw Error("Failed to update registration info");
        }

        return res.status(StatusCode.SuccessOK).send(newRegistrationInfo);
    },
);

registrationRouter.post(
    "/submit/",
    specification({
        method: "post",
        path: "/registration/submit/",
        tag: Tag.REGISTRATION,
        role: Role.USER,
        summary: "Submits the currently authenticated user's registration - permanent",
        body: RegistrationApplicationSubmittedRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The new registration information",
                schema: RegistrationApplicationSubmittedRequestSchema,
            },
            [StatusCode.ClientErrorBadRequest]: {
                id: RegistrationAlreadySubmittedError.error,
                description: "Registration is already submitted, cannot update anymore",
                schema: RegistrationAlreadySubmittedErrorSchema,
            },
            [StatusCode.ClientErrorForbidden]: {
                description: "Registration is closed",
                schema: RegistrationClosedErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);

        if (!isRegistrationAlive()) {
            return res.status(StatusCode.ClientErrorForbidden).send(RegistrationClosedError);
        }

        const isSubmitted = await Models.RegistrationApplicationSubmitted.findOne({ userId: userId });
        if (isSubmitted) {
            return res.status(StatusCode.ClientErrorBadRequest).send(RegistrationAlreadySubmittedError);
        }

        // Reviews are staff-only, so always start empty regardless of the request
        const submissionData: RegistrationApplicationSubmitted = {
            ...req.body,
            userId: userId,
            reviews: [],
            reviewCount: 0,
        } as RegistrationApplicationSubmitted;

        const [newSubmissionInfo] = await Promise.all([
            Models.RegistrationApplicationSubmitted.create(submissionData),
            Models.RegistrationApplicationDraft.deleteOne({ userId: userId }),
        ]);

        if (!newSubmissionInfo) {
            throw Error("Failed to submit registration");
        }

        const admissionInfo = await Models.AdmissionDecision.findOneAndUpdate(
            {
                userId: userId,
            },
            {
                userId,
                status: DecisionStatus.TBD,
            },
            { upsert: true, new: true },
        );

        if (!admissionInfo) {
            throw Error("Failed to update admission");
        }

        // SEND SUCCESSFUL REGISTRATION EMAIL
        await sendMail(Templates.REGISTRATION_SUBMISSION, newSubmissionInfo.email, {
            name: newSubmissionInfo.firstName,
            pro: newSubmissionInfo.pro ?? false,
        });

        return res.status(StatusCode.SuccessOK).send(newSubmissionInfo);
    },
);

/** Finds or creates the user's challenge. Upsert so concurrent first requests can't create duplicates. */
async function getOrCreateChallenge(userId: string): Promise<RegistrationChallenge> {
    const challenge = await Models.RegistrationChallenge.findOneAndUpdate(
        { userId },
        {
            $setOnInsert: { userId, instanceId: assignInstance(userId), attempts: 0, complete: false, bestScore: 0 },
        },
        { upsert: true, new: true },
    );
    if (!challenge) {
        throw Error("Failed to create challenge");
    }
    return challenge;
}

registrationRouter.get(
    "/challenge/",
    specification({
        method: "get",
        path: "/registration/challenge/",
        tag: Tag.REGISTRATION,
        role: Role.USER,
        summary: "Gets the Saloon Rush (Pro challenge) status for the currently authenticated user",
        description: "Creates the challenge and assigns a saloon floor plan on the first call.",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The challenge status",
                schema: RegistrationChallengeStatusSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Couldn't find your registration",
                schema: RegistrationNotFoundErrorSchema,
            },
            [StatusCode.ClientErrorForbidden]: {
                description: "You are not registered for this track",
                schema: RegistrationMissingProErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);

        const registrationData = await Models.RegistrationApplicationSubmitted.findOne({ userId });
        if (!registrationData) {
            return res.status(StatusCode.ClientErrorNotFound).send(RegistrationNotFoundError);
        }
        if (!registrationData.pro) {
            return res.status(StatusCode.ClientErrorForbidden).send(RegistrationMissingProError);
        }

        const challenge = await getOrCreateChallenge(userId);
        return res.status(StatusCode.SuccessOK).send(toChallengeStatus(challenge));
    },
);

registrationRouter.get(
    "/challenge/world/",
    specification({
        method: "get",
        path: "/registration/challenge/world/",
        tag: Tag.REGISTRATION,
        role: Role.USER,
        summary: "Downloads the Saloon Rush floor plan (world.json) assigned to the currently authenticated user",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The floor plan, as world.json",
                schema: RegistrationChallengeWorldSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Couldn't find your registration",
                schema: RegistrationNotFoundErrorSchema,
            },
            [StatusCode.ClientErrorForbidden]: {
                description: "You are not registered for this track",
                schema: RegistrationMissingProErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);

        const registrationData = await Models.RegistrationApplicationSubmitted.findOne({ userId });
        if (!registrationData) {
            return res.status(StatusCode.ClientErrorNotFound).send(RegistrationNotFoundError);
        }
        if (!registrationData.pro) {
            return res.status(StatusCode.ClientErrorForbidden).send(RegistrationMissingProError);
        }

        const challenge = await getOrCreateChallenge(userId);
        const { text } = await getWorldFile(challenge.instanceId);

        res.attachment("world.json");
        res.type("application/json");
        return res.status(StatusCode.SuccessOK).send(text);
    },
);

registrationRouter.post(
    "/challenge/",
    specification({
        method: "post",
        path: "/registration/challenge/",
        tag: Tag.REGISTRATION,
        role: Role.USER,
        summary: "Submits a gang's plan.json for Saloon Rush and grades it",
        description:
            "Multipart upload with the file in the `solution` field. " +
            "Any gradable plan returns 200 with its report, even with a low score. " +
            "Only the best score counts, and resubmitting is allowed until registration closes.",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The plan was graded, the new challenge status is returned",
                schema: RegistrationChallengeStatusSchema,
            },
            [StatusCode.ClientErrorBadRequest]: [
                {
                    id: RegistrationChallengeInvalidPlanErrorId,
                    description: "The plan couldn't be graded (bad JSON, wrong shape, wrong instance, unknown ids)",
                    schema: RegistrationChallengeInvalidPlanErrorSchema,
                },
                {
                    id: RegistrationChallengeNoFileError.error,
                    description: "No .json file was uploaded",
                    schema: RegistrationChallengeNoFileErrorSchema,
                },
                {
                    id: RegistrationChallengeNotFoundError.error,
                    description: "No registration or challenge exists yet",
                    schema: RegistrationChallengeNotFoundErrorSchema,
                },
            ],
            [StatusCode.ClientErrorForbidden]: {
                description: "Registration is closed",
                schema: RegistrationClosedErrorSchema,
            },
        },
    }),
    singleJsonFile("solution"),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);

        if (!isRegistrationAlive()) {
            return res.status(StatusCode.ClientErrorForbidden).send(RegistrationClosedError);
        }

        if (!req.file) {
            return res.status(StatusCode.ClientErrorBadRequest).send(RegistrationChallengeNoFileError);
        }

        const registration = await Models.RegistrationApplicationSubmitted.findOne({ userId });
        if (!registration) {
            return res.status(StatusCode.ClientErrorBadRequest).send(RegistrationChallengeNotFoundError);
        }

        const challenge = await Models.RegistrationChallenge.findOne({ userId });
        if (!challenge) {
            return res.status(StatusCode.ClientErrorBadRequest).send(RegistrationChallengeNotFoundError);
        }

        const { world } = await getWorldFile(challenge.instanceId);

        let report: GradeReport;
        try {
            report = gradePlan(world, parsePlan(req.file.buffer.toString("utf8")));
        } catch (err) {
            if (!(err instanceof InvalidPlanError)) {
                throw err;
            }
            await Models.RegistrationChallenge.updateOne({ userId }, { $inc: { attempts: 1 } });
            return res.status(StatusCode.ClientErrorBadRequest).send(RegistrationChallengeInvalidPlanError(err.message));
        }

        // Atomic so concurrent submissions can never lower the best score
        let updated = await Models.RegistrationChallenge.findOneAndUpdate(
            { userId },
            { $inc: { attempts: 1 }, $max: { bestScore: report.score }, $set: { lastReport: toStoredReport(report) } },
            { new: true },
        );
        if (!updated) {
            throw Error("Failed to update challenge");
        }

        const normalized = normalizeScore(updated.instanceId, updated.bestScore ?? 0);
        if (normalized !== null) {
            // Only the request that flips `complete` marks the admission and sends the email
            let justPassed = false;
            if (!updated.complete && normalized >= Config.PRO_CHALLENGE_PASS_RATIO) {
                const flipped = await Models.RegistrationChallenge.findOneAndUpdate(
                    { userId, complete: false },
                    { complete: true },
                    { new: true },
                );
                if (flipped) {
                    updated = flipped;
                    justPassed = true;
                }
            }

            const admission = await Models.AdmissionDecision.findOneAndUpdate(
                { userId },
                { $max: { proChallengeScore: normalized }, ...(justPassed ? { $set: { correctProChallenge: true } } : {}) },
                { new: true },
            );
            if (!admission) {
                throw Error("Failed to update admission");
            }

            if (justPassed) {
                // SEND CHALLENGE COMPLETION EMAIL
                await sendMail(Templates.CHALLENGE_COMPLETION, registration.email, {
                    name: registration.firstName,
                });
            }
        }

        return res.status(StatusCode.SuccessOK).send(toChallengeStatus(updated));
    },
);

export default registrationRouter;
