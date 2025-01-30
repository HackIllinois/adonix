import { StatusCode } from "status-code-enum";
import { Router } from "express";

import { RegistrationTemplates } from "../../common/config";

import Models from "../../common/models";
import {
    RegistrationAlreadySubmittedError,
    RegistrationAlreadySubmittedErrorSchema,
    RegistrationApplication,
    RegistrationApplicationRequestSchema,
    RegistrationApplicationSchema,
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
import { generateChallenge } from "./challenge-lib";

const registrationRouter = Router();

registrationRouter.get(
    "/status/",
    specification({
        method: "get",
        path: "/registration/status/",
        tag: Tag.REGISTRATION,
        role: null,
        summary: "Gets the currently authenticated user's registration data",
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
        summary: "Gets the currently authenticated user's registration data",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The registration information",
                schema: RegistrationApplicationSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Couldn't find registration information (make sure you create it first!)",
                schema: RegistrationNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);

        const registrationData = await Models.RegistrationApplication.findOne({ userId });
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
                schema: RegistrationApplicationSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Couldn't find registration information (make sure you create it first!)",
                schema: RegistrationNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = req.params;

        const registrationData = await Models.RegistrationApplication.findOne({ userId: userId });
        if (!registrationData) {
            return res.status(StatusCode.ClientErrorNotFound).send(RegistrationNotFoundError);
        }

        return res.status(StatusCode.SuccessOK).send(registrationData);
    },
);

registrationRouter.post(
    "/",
    specification({
        method: "post",
        path: "/registration/",
        tag: Tag.REGISTRATION,
        role: Role.USER,
        summary: "Creates or sets the currently authenticated user's registration data",
        body: RegistrationApplicationRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The new registration information",
                schema: RegistrationApplicationRequestSchema,
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

        const registrationInfo = await Models.RegistrationApplication.findOne({ userId: userId });
        if (registrationInfo?.hasSubmitted ?? false) {
            return res.status(StatusCode.ClientErrorBadRequest).send(RegistrationAlreadySubmittedError);
        }

        const updateRegistration: RegistrationApplication = {
            ...setRequest,
            userId,
            hasSubmitted: false,
        };
        const newRegistrationInfo = await Models.RegistrationApplication.findOneAndReplace(
            { userId: userId },
            updateRegistration,
            {
                upsert: true,
                new: true,
            },
        );
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
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The new registration information",
                schema: RegistrationApplicationRequestSchema,
            },
            [StatusCode.ClientErrorBadRequest]: {
                description: "Registration is already submitted, cannot update anymore",
                schema: RegistrationAlreadySubmittedErrorSchema,
            },
            [StatusCode.ClientErrorForbidden]: {
                description: "Registration is closed",
                schema: RegistrationClosedErrorSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Couldn't find registration information (make sure you create it first!)",
                schema: RegistrationNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);

        if (!isRegistrationAlive()) {
            return res.status(StatusCode.ClientErrorForbidden).send(RegistrationClosedError);
        }

        const registrationInfo = await Models.RegistrationApplication.findOne({ userId: userId });

        if (!registrationInfo) {
            return res.status(StatusCode.ClientErrorNotFound).send(RegistrationNotFoundError);
        }

        if (registrationInfo.hasSubmitted) {
            return res.status(StatusCode.ClientErrorBadRequest).send(RegistrationAlreadySubmittedError);
        }

        const newRegistrationInfo = await Models.RegistrationApplication.findOneAndUpdate(
            { userId: userId },
            { hasSubmitted: true },
            { new: true },
        );

        if (!newRegistrationInfo) {
            throw Error("Failed to update registration");
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
            templateId: RegistrationTemplates.REGISTRATION_SUBMISSION,
            recipients: [registrationInfo.emailAddress],
            subs: { name: registrationInfo.preferredName },
        };
        await sendMail(mailInfo);

        return res.status(StatusCode.SuccessOK).send(newRegistrationInfo);
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

        let challenge: RegistrationChallenge | null = await Models.RegistrationChallenge.findOne({ userId });
        if (!challenge) {
            challenge = { userId, ...generateChallenge(), attempts: 0, complete: false };
            await Models.RegistrationChallenge.create(challenge);
        }

        return res.status(StatusCode.SuccessOK).send({
            alliances: challenge.alliances,
            people: Object.fromEntries(challenge.people.entries()),
            attempts: challenge.attempts,
            complete: challenge.complete,
        });
    },
);

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

export default registrationRouter;
