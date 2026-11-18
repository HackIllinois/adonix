import { StatusCode } from "status-code-enum";
import { Response, Router } from "express";

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
    ChallengeTierNumberSchema,
    ChallengeLeaderboardQueryLimitSchema,
    ChallengeLeaderboardSchema,
    ChallengeTierNotAvailableError,
    ChallengeTierNotAvailableErrorSchema,
    ChallengeSubmissionTooSoonError,
    ChallengeSubmissionTooSoonErrorSchema,
} from "./registration-schemas";
import { DecisionStatus } from "../admission/admission-schemas";

import { getAuthenticatedUser } from "../../common/auth";
import { Role } from "../auth/auth-schemas";

import { sendMail } from "../mail/mail-lib";
import { isRegistrationAlive } from "./registration-lib";
import specification, { ResponsesObject, Tag } from "../../middleware/specification";
import { z } from "zod";
import { UserIdSchema } from "../../common/schemas";
import {
    TierNumber,
    assignInstance,
    getWorldFile,
    isLiveTier,
    liveTiers,
    nextSubmitAt,
    overallScore,
    tierPath,
    tierProgress,
    toChallengeStatus,
    toStoredReport,
} from "./challenge-lib";
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

/** Finds or creates the user's challenge and every live tier's floor plan. Upserts, so concurrent first requests are safe. */
async function getOrCreateChallenge(userId: string): Promise<RegistrationChallenge> {
    let challenge = await Models.RegistrationChallenge.findOneAndUpdate(
        { userId },
        {
            $setOnInsert: { userId, instanceId: assignInstance(userId), attempts: 0, complete: false, bestScore: 0 },
        },
        { upsert: true, new: true },
    );
    if (!challenge) {
        throw Error("Failed to create challenge");
    }
    for (const tier of liveTiers()) {
        if (tier === 1 || tierProgress(challenge, tier)) {
            continue;
        }
        const field = `tier${tier}`;
        challenge =
            (await Models.RegistrationChallenge.findOneAndUpdate(
                { userId, [field]: { $exists: false } },
                { $set: { [field]: { instanceId: assignInstance(userId, tier), attempts: 0, bestScore: 0 } } },
                { new: true },
            )) ?? (await Models.RegistrationChallenge.findOne({ userId }))!;
    }
    return challenge;
}

/** null if the user has a submitted Pro registration, otherwise the error to send. */
async function checkProRegistration(
    userId: string,
): Promise<{ status: StatusCode; body: typeof RegistrationNotFoundError | typeof RegistrationMissingProError } | null> {
    const registrationData = await Models.RegistrationApplicationSubmitted.findOne({ userId });
    if (!registrationData) {
        return { status: StatusCode.ClientErrorNotFound, body: RegistrationNotFoundError };
    }
    if (!registrationData.pro) {
        return { status: StatusCode.ClientErrorForbidden, body: RegistrationMissingProError };
    }
    return null;
}

const ChallengeTierParamsSchema = z.object({ tier: ChallengeTierNumberSchema });

// What the shared challenge handlers need from a request, whichever route it came in on
type ChallengeRequest = Parameters<typeof getAuthenticatedUser>[0] & { file?: Express.Multer.File };

registrationRouter.get(
    "/challenge/",
    specification({
        method: "get",
        path: "/registration/challenge/",
        tag: Tag.REGISTRATION,
        role: Role.USER,
        summary: "Gets the Saloon Rush (Pro challenge) status for the currently authenticated user",
        description:
            "Creates the challenge and assigns a saloon floor plan per live tier on the first call. " +
            "The top-level fields describe Tier 1; `tiers` lists every live tier.",
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

        const problem = await checkProRegistration(userId);
        if (problem) {
            return res.status(problem.status).send(problem.body);
        }

        const challenge = await getOrCreateChallenge(userId);
        return res.status(StatusCode.SuccessOK).send(toChallengeStatus(challenge));
    },
);

registrationRouter.get(
    "/challenge/leaderboard/",
    specification({
        method: "get",
        path: "/registration/challenge/leaderboard/",
        tag: Tag.REGISTRATION,
        role: Role.USER,
        summary: "Gets the anonymous Saloon Rush leaderboard",
        description:
            "Ranked by overall score, then fewer walking minutes, then who got there first. " +
            "Shows no names or ids; the requester's own entry is flagged with `you`.",
        query: z.object({ limit: ChallengeLeaderboardQueryLimitSchema.optional() }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The leaderboard",
                schema: ChallengeLeaderboardSchema,
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

        const problem = await checkProRegistration(userId);
        if (problem) {
            return res.status(problem.status).send(problem.body);
        }

        const limit = req.query.limit ?? Config.LEADERBOARD_QUERY_LIMIT;
        const ranked = { overallScore: { $ne: null } };
        const [top, total, mine] = await Promise.all([
            Models.RegistrationChallenge.find(ranked)
                .sort({ overallScore: -1, overallTravelMinutes: 1, overallAt: 1 })
                .limit(limit),
            Models.RegistrationChallenge.countDocuments(ranked),
            Models.RegistrationChallenge.findOne({ userId }),
        ]);

        let yourRank: number | null = null;
        if (mine && mine.overallScore !== null && mine.overallScore !== undefined) {
            const score = mine.overallScore;
            const travel = mine.overallTravelMinutes ?? 0;
            const at = mine.overallAt ?? 0;
            const ahead = await Models.RegistrationChallenge.countDocuments({
                $or: [
                    { overallScore: { $gt: score } },
                    { overallScore: score, overallTravelMinutes: { $lt: travel } },
                    { overallScore: score, overallTravelMinutes: travel, overallAt: { $lt: at } },
                ],
            });
            yourRank = ahead + 1;
        }

        return res.status(StatusCode.SuccessOK).send({
            entries: top.map((challenge, i) => ({
                rank: i + 1,
                overallScore: challenge.overallScore!,
                tierScores: overallScore(challenge).tierScores,
                you: challenge.userId === userId,
            })),
            yourRank,
            total,
        });
    },
);

const worldResponses = {
    [StatusCode.SuccessOK]: {
        description: "The floor plan, as world.json",
        schema: RegistrationChallengeWorldSchema,
    },
    [StatusCode.ClientErrorNotFound]: [
        {
            id: RegistrationNotFoundError.error,
            description: "Couldn't find your registration",
            schema: RegistrationNotFoundErrorSchema,
        },
        {
            id: ChallengeTierNotAvailableError.error,
            description: "That tier isn't live yet",
            schema: ChallengeTierNotAvailableErrorSchema,
        },
    ],
    [StatusCode.ClientErrorForbidden]: {
        description: "You are not registered for this track",
        schema: RegistrationMissingProErrorSchema,
    },
} satisfies ResponsesObject;

async function sendWorld(req: ChallengeRequest, res: Response, tier: TierNumber): Promise<Response> {
    const { id: userId } = getAuthenticatedUser(req);

    const problem = await checkProRegistration(userId);
    if (problem) {
        return res.status(problem.status).send(problem.body);
    }

    const challenge = await getOrCreateChallenge(userId);
    const progress = tierProgress(challenge, tier);
    if (!progress) {
        return res.status(StatusCode.ClientErrorNotFound).send(ChallengeTierNotAvailableError);
    }
    const { text } = await getWorldFile(progress.instanceId);

    res.attachment("world.json");
    res.type("application/json");
    return res.status(StatusCode.SuccessOK).send(text);
}

registrationRouter.get(
    "/challenge/world/",
    specification({
        method: "get",
        path: "/registration/challenge/world/",
        tag: Tag.REGISTRATION,
        role: Role.USER,
        summary: "Downloads the Tier 1 Saloon Rush floor plan (world.json) assigned to the currently authenticated user",
        responses: worldResponses,
    }),
    async (req, res) => sendWorld(req, res, 1),
);

registrationRouter.get(
    "/challenge/world/:tier/",
    specification({
        method: "get",
        path: "/registration/challenge/world/{tier}/",
        tag: Tag.REGISTRATION,
        role: Role.USER,
        summary: "Downloads the floor plan (world.json) for one tier",
        parameters: ChallengeTierParamsSchema,
        responses: worldResponses,
    }),
    async (req, res) => {
        // Validated by the spec, but params arrive as strings
        const tier = Number(req.params.tier);
        if (!isLiveTier(tier)) {
            return res.status(StatusCode.ClientErrorNotFound).send(ChallengeTierNotAvailableError);
        }
        return sendWorld(req, res, tier);
    },
);

const submitResponses = {
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
    [StatusCode.ClientErrorNotFound]: {
        description: "That tier isn't live yet",
        schema: ChallengeTierNotAvailableErrorSchema,
    },
    [StatusCode.ClientErrorTooManyRequests]: {
        description: `Uploaded this tier less than ${Config.CHALLENGE_SUBMIT_COOLDOWN_SECONDS} seconds ago`,
        schema: ChallengeSubmissionTooSoonErrorSchema,
    },
} satisfies ResponsesObject;

const SUBMIT_DESCRIPTION =
    "Multipart upload with the file in the `solution` field. " +
    "Any gradable plan returns 200 with its report, even with a low score. " +
    "Only the best score counts, and resubmitting is allowed until registration closes, " +
    `once every ${Config.CHALLENGE_SUBMIT_COOLDOWN_SECONDS} seconds per tier.`;

async function submitPlan(req: ChallengeRequest, res: Response, tier: TierNumber): Promise<Response> {
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

    let challenge: RegistrationChallenge | null = await Models.RegistrationChallenge.findOne({ userId });
    if (!challenge) {
        return res.status(StatusCode.ClientErrorBadRequest).send(RegistrationChallengeNotFoundError);
    }
    if (!tierProgress(challenge, tier)) {
        challenge = await getOrCreateChallenge(userId);
    }
    const progress = tierProgress(challenge, tier);
    if (!progress) {
        return res.status(StatusCode.ClientErrorNotFound).send(ChallengeTierNotAvailableError);
    }

    // Claim this tier's upload slot atomically, so the cooldown holds even for concurrent uploads
    const now = Date.now();
    const cooldownMs = Config.CHALLENGE_SUBMIT_COOLDOWN_SECONDS * Config.MILLISECONDS_PER_SECOND;
    const lastSubmittedPath = tierPath(tier, "lastSubmittedAt");
    const claimed = await Models.RegistrationChallenge.findOneAndUpdate(
        {
            userId,
            $or: [{ [lastSubmittedPath]: { $exists: false } }, { [lastSubmittedPath]: { $lte: now - cooldownMs } }],
        },
        { $set: { [lastSubmittedPath]: now } },
        { new: true },
    );
    if (!claimed) {
        const next = nextSubmitAt(progress.lastSubmittedAt, now) ?? now + cooldownMs;
        const retryAfterSeconds = Math.max(1, Math.ceil((next - now) / Config.MILLISECONDS_PER_SECOND));
        res.set("Retry-After", `${retryAfterSeconds}`);
        return res.status(StatusCode.ClientErrorTooManyRequests).send(ChallengeSubmissionTooSoonError(retryAfterSeconds));
    }

    const { world } = await getWorldFile(progress.instanceId);

    let report: GradeReport;
    try {
        report = gradePlan(world, parsePlan(req.file.buffer.toString("utf8")));
    } catch (err) {
        if (!(err instanceof InvalidPlanError)) {
            throw err;
        }
        await Models.RegistrationChallenge.updateOne({ userId }, { $inc: { [tierPath(tier, "attempts")]: 1 } });
        return res.status(StatusCode.ClientErrorBadRequest).send(RegistrationChallengeInvalidPlanError(err.message));
    }

    await Models.RegistrationChallenge.updateOne(
        { userId },
        { $inc: { [tierPath(tier, "attempts")]: 1 }, $set: { [tierPath(tier, "lastReport")]: toStoredReport(report) } },
    );

    // Keep the best plan: a higher score, or the same score with fewer walking minutes.
    // Conditional and atomic, so concurrent uploads can never lower it.
    const bestPath = tierPath(tier, "bestScore");
    const travelPath = tierPath(tier, "bestTravelMinutes");
    await Models.RegistrationChallenge.updateOne(
        {
            userId,
            $or: [
                { [bestPath]: { $exists: false } },
                { [bestPath]: { $lt: report.score } },
                {
                    [bestPath]: report.score,
                    $or: [{ [travelPath]: { $exists: false } }, { [travelPath]: { $gt: report.travelMinutes } }],
                },
            ],
        },
        { $set: { [bestPath]: report.score, [travelPath]: report.travelMinutes } },
    );

    let updated = await Models.RegistrationChallenge.findOne({ userId });
    if (!updated) {
        throw Error("Failed to update challenge");
    }

    const overall = overallScore(updated).score;
    if (overall !== null) {
        // The overall score only goes up, so a conditional update keeps the earliest time it reached each level
        await Models.RegistrationChallenge.updateOne(
            { userId, $or: [{ overallScore: { $exists: false } }, { overallScore: null }, { overallScore: { $lt: overall } }] },
            { $set: { overallScore: overall, overallAt: now } },
        );
        await Models.RegistrationChallenge.updateOne(
            { userId },
            { $set: { overallTravelMinutes: overallScore(updated).travelMinutes } },
        );

        // Only the request that flips `complete` marks the admission and sends the email
        let justPassed = false;
        if (!updated.complete && overall >= Config.PRO_CHALLENGE_PASS_RATIO) {
            const flipped = await Models.RegistrationChallenge.findOneAndUpdate(
                { userId, complete: false },
                { complete: true },
                { new: true },
            );
            if (flipped) {
                justPassed = true;
            }
        }

        const admission = await Models.AdmissionDecision.findOneAndUpdate(
            { userId },
            { $max: { proChallengeScore: overall }, ...(justPassed ? { $set: { correctProChallenge: true } } : {}) },
            { new: true },
        );
        if (!admission) {
            throw Error("Failed to update admission");
        }

        updated = (await Models.RegistrationChallenge.findOne({ userId }))!;

        if (justPassed) {
            // SEND CHALLENGE COMPLETION EMAIL
            await sendMail(Templates.CHALLENGE_COMPLETION, registration.email, {
                name: registration.firstName,
            });
        }
    }

    return res.status(StatusCode.SuccessOK).send(toChallengeStatus(updated));
}

registrationRouter.post(
    "/challenge/",
    specification({
        method: "post",
        path: "/registration/challenge/",
        tag: Tag.REGISTRATION,
        role: Role.USER,
        summary: "Submits a gang's Tier 1 plan.json for Saloon Rush and grades it",
        description: SUBMIT_DESCRIPTION,
        responses: submitResponses,
    }),
    singleJsonFile("solution"),
    async (req, res) => submitPlan(req, res, 1),
);

registrationRouter.post(
    "/challenge/:tier/",
    specification({
        method: "post",
        path: "/registration/challenge/{tier}/",
        tag: Tag.REGISTRATION,
        role: Role.USER,
        summary: "Submits a gang's plan.json for one tier and grades it",
        description: SUBMIT_DESCRIPTION,
        parameters: ChallengeTierParamsSchema,
        responses: submitResponses,
    }),
    singleJsonFile<{ tier: number }>("solution"),
    async (req, res) => {
        // Validated by the spec, but params arrive as strings
        const tier = Number(req.params.tier);
        if (!isLiveTier(tier)) {
            return res.status(StatusCode.ClientErrorNotFound).send(ChallengeTierNotAvailableError);
        }
        return submitPlan(req, res, tier);
    },
);

export default registrationRouter;
