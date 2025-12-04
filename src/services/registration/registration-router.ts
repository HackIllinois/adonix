import { StatusCode } from "status-code-enum";
import { Router } from "express";

import { Templates } from "../../common/config";

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
    RegistrationChallengeSolveFailedError,
    RegistrationChallengeSolveFailedErrorSchema,
    RegistrationChallengeSolveSchema,
    RegistrationClosedError,
    RegistrationClosedErrorSchema,
    RegistrationNotFoundError,
    RegistrationNotFoundErrorSchema,
    RegistrationStatusSchema,
    RegistrationChallengeAlreadySolvedError,
    RegistrationChallengeAlreadySolvedErrorSchema,
    RegistrationMissingProErrorSchema,
    RegistrationMissingProError,
} from "./registration-schemas";
import { DecisionStatus } from "../admission/admission-schemas";

import { getAuthenticatedUser } from "../../common/auth";
import { Role } from "../auth/auth-schemas";

import { sendMail } from "../mail/mail-lib";
import { MailInfo } from "../mail/mail-schemas";
import { isRegistrationAlive } from "./registration-lib";
import specification, { Tag } from "../../middleware/specification";
import { z } from "zod";
import { UserIdSchema } from "../../common/schemas";
import { generateChallenge2026 } from "./challenge-lib";

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

        const submissionData: RegistrationApplicationSubmitted = {
            ...req.body,
            userId: userId,
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
        const mailInfo: MailInfo = {
            templateId: Templates.REGISTRATION_SUBMISSION,
            recipient: newSubmissionInfo.email,
            templateData: { name: newSubmissionInfo.firstName, pro: newSubmissionInfo.pro ?? false },
        };
        await sendMail(mailInfo);

        return res.status(StatusCode.SuccessOK).send(newSubmissionInfo);
    },
);

registrationRouter.get(
    "/challenge/",
    specification({
        method: "get",
        path: "/registration/challenge/",
        tag: Tag.REGISTRATION,
        role: Role.USER,
        summary: "Gets the challenge input for the currently authenticated user",
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

        let challenge: RegistrationChallenge | null = await Models.RegistrationChallenge.findOne({ userId });
        if (!challenge) {
            challenge = { userId, ...generateChallenge2026(userId), attempts: 0, complete: false };
            await Models.RegistrationChallenge.create(challenge);
        }

        return res.status(StatusCode.SuccessOK).send({
            inputFileId: challenge.inputFileId,
            attempts: challenge.attempts,
            complete: challenge.complete,
        });
    },
);
/*
registrationRouter.post(
    "/challenge/",
    specification({
        method: "post",
        path: "/registration/challenge/",
        tag: Tag.REGISTRATION,
        role: Role.USER,
        body: RegistrationChallengeSolveSchema,
        summary: "Attempts to solve the challenge",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Successfully solved, the new challenge status is returned",
                schema: RegistrationChallengeStatusSchema,
            },
            [StatusCode.ClientErrorBadRequest]: [
                {
                    id: RegistrationChallengeSolveFailedError.error,
                    description: "Incorrect answer, try again",
                    schema: RegistrationChallengeSolveFailedErrorSchema,
                },
                {
                    id: RegistrationChallengeAlreadySolvedError.error,
                    description: "Already solved correctly",
                    schema: RegistrationChallengeAlreadySolvedErrorSchema,
                },
            ],
            [StatusCode.ClientErrorForbidden]: {
                description: "Registration is closed",
                schema: RegistrationClosedErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { solution } = req.body;
        const { id: userId } = getAuthenticatedUser(req);

        if (!isRegistrationAlive()) {
            return res.status(StatusCode.ClientErrorForbidden).send(RegistrationClosedError);
        }

        const challenge: RegistrationChallenge | null = await Models.RegistrationChallenge.findOne({ userId });
        if (challenge?.complete) {
            return res.status(StatusCode.ClientErrorForbidden).send(RegistrationChallengeAlreadySolvedError);
        }
        if (solution != challenge?.solution) {
            if (challenge) {
                await Models.RegistrationChallenge.findOneAndUpdate({ userId }, { attempts: challenge.attempts + 1 });
            }
            return res.status(StatusCode.ClientErrorBadRequest).send(RegistrationChallengeSolveFailedError);
        }

        const result = await Models.RegistrationChallenge.findOneAndUpdate(
            { userId },
            {
                attempts: challenge.attempts + 1,
                complete: true,
            },
            {
                new: true,
            },
        );

        if (!result) {
            throw Error("Failed to update challenge");
        }

        return res.status(StatusCode.SuccessOK).send({
            alliances: result.alliances,
            people: Object.fromEntries(result.people.entries()),
            attempts: result.attempts,
            complete: result.complete,
        });
    },
);
*/
export default registrationRouter;
