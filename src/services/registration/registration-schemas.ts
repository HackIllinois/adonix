import { index, modelOptions, prop } from "@typegoose/typegoose";
import { z } from "zod";
import { CreateErrorAndSchema, UserIdSchema } from "../../common/schemas";
import Config from "../../common/config";
import { GradeReportSchema } from "./saloon/saloon-schemas";

export class ApplicationReview {
    @prop({ required: true })
    public reviewerId: string;

    // null = assigned to the reviewer but not yet scored
    @prop({ type: Number, default: null })
    public score: number | null;

    @prop({ required: false })
    public comment?: string;
}

@index({ reviewCount: 1 })
@index({ "reviews.reviewerId": 1, "reviews.score": 1 })
export class RegistrationApplicationSubmitted {
    @prop({ required: true, index: true })
    public userId: string;

    @prop({ required: true })
    public firstName: string;

    @prop({ required: true })
    public lastName: string;

    @prop({ required: false })
    public preferredName?: string;

    @prop({ required: true })
    public age: string;

    @prop({ required: true })
    public email: string;

    @prop({ required: true })
    public phoneNumber: string;

    @prop({ required: true })
    public gender: string;

    @prop({
        required: true,
        type: String,
    })
    public race: string[];

    @prop({ required: true })
    public country: string;

    @prop({ required: false })
    public state?: string;

    @prop({ required: true })
    public school: string;

    @prop({ required: true })
    public education: string;

    @prop({ required: true })
    public graduate: string;

    @prop({ required: true })
    public major: string;

    @prop({ required: true })
    public underrepresented: string;

    @prop({ required: true })
    public hackathonsParticipated: string;

    // Ranking of which area the applicant is more interested in
    @prop({ required: true })
    public interestSoftware: string;

    @prop({ required: true })
    public interestHardware: string;

    @prop({ required: true })
    public application1: string;

    @prop({ required: true })
    public application2: string;

    @prop({ required: true })
    public application3: string;

    @prop({ required: false })
    public applicationOptional?: string;

    @prop({ required: false })
    public firstHackathonReason?: string;

    @prop({ required: false })
    public portfolioLink?: string;

    @prop({ required: false })
    public eventSuggestions?: string;

    @prop({ required: false })
    public pro?: boolean;

    @prop({
        required: true,
        type: String,
    })
    public attribution: string[];

    @prop({
        required: true,
        type: String,
    })
    public eventInterest: string[];

    @prop({
        required: true,
        type: String,
    })
    public vcInvolvement: string[];

    @prop({ required: true })
    public hardwareInterest: string;

    @prop({ required: true })
    requestTravelReimbursement: boolean;

    @prop({ required: true })
    mlhNewsletter: boolean;

    // Staff reviews - hidden by default so they are never sent to applicants
    @prop({ type: () => [ApplicationReview], _id: false, default: [], select: false })
    public reviews?: ApplicationReview[];

    // Always equal to reviews.length, kept so we can sort by it atomically
    @prop({ default: 0, select: false })
    public reviewCount?: number;
}

export class RegistrationApplicationDraft {
    @prop({ required: true, index: true })
    public userId: string;

    @prop({ required: false })
    public firstName?: string;

    @prop({ required: false })
    public lastName?: string;

    @prop({ required: false })
    public preferredName?: string;

    @prop({ required: false })
    public age?: string;

    @prop({ required: false })
    public email?: string;

    @prop({ required: false })
    public phoneNumber?: string;

    @prop({ required: false })
    public gender?: string;

    @prop({
        required: false,
        type: String,
    })
    public race?: string[];

    @prop({ required: false })
    public country?: string;

    @prop({ required: false })
    public state?: string;

    @prop({ required: false })
    public school?: string;

    @prop({ required: false })
    public education?: string;

    @prop({ required: false })
    public graduate?: string;

    @prop({ required: false })
    public major?: string;

    @prop({ required: false })
    public underrepresented?: string;

    @prop({ required: false })
    public hackathonsParticipated?: string;

    @prop({ required: false })
    public interestSoftware?: string;

    @prop({ required: false })
    public interestHardware?: string;

    @prop({ required: false })
    public application1?: string;

    @prop({ required: false })
    public application2?: string;

    @prop({ required: false })
    public application3?: string;

    @prop({ required: false })
    public applicationOptional?: string;

    @prop({ required: false })
    public firstHackathonReason?: string;

    @prop({ required: false })
    public portfolioLink?: string;

    @prop({ required: false })
    public eventSuggestions?: string;

    @prop({ required: false })
    public pro?: boolean;

    @prop({
        required: false,
        type: String,
    })
    public attribution?: string[];

    @prop({
        required: false,
        type: String,
    })
    public eventInterest?: string[];

    @prop({
        required: false,
        type: String,
    })
    public vcInvolvement?: string[];

    @prop({ required: false })
    public hardwareInterest?: string;

    @prop({ required: false })
    requestTravelReimbursement?: boolean;

    @prop({ required: false })
    mlhNewsletter?: boolean;
}

@modelOptions({ schemaOptions: { _id: false } })
export class ChallengeRouteError {
    @prop({ required: true })
    public driver: string;

    @prop({ required: true })
    public index: number;

    @prop({ required: true })
    public message: string;
}

@modelOptions({ schemaOptions: { _id: false } })
export class ChallengeGradeReport {
    @prop({ required: true })
    public instance: string;

    @prop({ required: true })
    public score: number;

    @prop({ required: true })
    public totalOrders: number;

    @prop({ required: true })
    public completed: number;

    @prop({ required: true })
    public onTime: number;

    @prop({ required: true })
    public lateMinutes: number;

    @prop({ required: true })
    public travelMinutes: number;

    // Called `errors` in the API, but that name is reserved by mongoose
    @prop({ required: true, type: () => [ChallengeRouteError] })
    public routeErrors: ChallengeRouteError[];

    // Tier 3 power-ups (absent on reports saved before power-ups existed)
    @prop({ required: false })
    public coinsEarned?: number;

    @prop({ required: false })
    public coinsSpent?: number;

    @prop({ required: false, type: () => [ChallengePowerupError] })
    public powerupErrors?: ChallengePowerupError[];
}

@modelOptions({ schemaOptions: { _id: false } })
export class ChallengePowerupError {
    @prop({ required: true })
    public index: number;

    @prop({ required: true })
    public message: string;
}

/** One applicant's progress on Tier 2 or Tier 3. Tier 1 keeps the same fields at the top of RegistrationChallenge. */
@modelOptions({ schemaOptions: { _id: false } })
export class ChallengeTierProgress {
    @prop({ required: true })
    public instanceId: string;

    @prop({ default: 0 })
    public attempts: number;

    @prop({ default: 0 })
    public bestScore?: number;

    // Walking minutes of the best plan, used to break ties
    @prop({ required: false })
    public bestTravelMinutes?: number;

    @prop({ required: false, type: () => ChallengeGradeReport })
    public lastReport?: ChallengeGradeReport;

    // Epoch ms of the last upload, for the cooldown
    @prop({ required: false })
    public lastSubmittedAt?: number;
}

@index({ overallScore: -1, overallTravelMinutes: 1, overallAt: 1 })
export class RegistrationChallenge {
    @prop({ required: true, index: true })
    public userId: string;

    // Tier 1 world assigned to this user, see SALOON_INSTANCES in challenge-lib.
    // Tier 1's progress lives at the top level so the original (v1) API and records keep working.
    @prop({ required: true })
    public instanceId: string;

    @prop({ required: true })
    public attempts: number;

    // True once the overall score reaches the pass ratio. Never goes back to false.
    @prop({ required: true })
    public complete: boolean;

    @prop({ default: 0 })
    public bestScore?: number;

    @prop({ required: false, type: () => ChallengeGradeReport })
    public lastReport?: ChallengeGradeReport;

    @prop({ required: false })
    public bestTravelMinutes?: number;

    @prop({ required: false })
    public lastSubmittedAt?: number;

    @prop({ required: false, type: () => ChallengeTierProgress })
    public tier2?: ChallengeTierProgress;

    @prop({ required: false, type: () => ChallengeTierProgress })
    public tier3?: ChallengeTierProgress;

    // Average of best / reference over the live tiers (null until every live tier is calibrated)
    @prop({ type: Number, required: false })
    public overallScore?: number | null;

    // Total walking minutes of the best plans across live tiers, for leaderboard ties
    @prop({ required: false })
    public overallTravelMinutes?: number;

    // Epoch ms when overallScore last went up, for leaderboard ties
    @prop({ required: false })
    public overallAt?: number;
}

export const RegistrationStatusSchema = z
    .object({
        alive: z.boolean(),
    })
    .openapi("RegistrationStatus", {
        description: "If registration is currently open or not",
    });

export const RegistrationApplicationSubmittedRequestSchema = z
    .object({
        firstName: z.string().max(Config.MAX_STRING_LENGTH),
        lastName: z.string().max(Config.MAX_STRING_LENGTH),
        preferredName: z.string().max(Config.MAX_STRING_LENGTH).optional(),
        age: z.string().max(Config.MAX_STRING_LENGTH),
        email: z.string().email({ message: "Invalid email." }).max(Config.MAX_STRING_LENGTH),
        phoneNumber: z.string().max(Config.MAX_STRING_LENGTH),
        gender: z.string().max(Config.MAX_STRING_LENGTH),
        race: z.array(z.string()).max(Config.MAX_ARRAY_LENGTH),
        country: z.string().max(Config.MAX_STRING_LENGTH),
        state: z.string().max(Config.MAX_STRING_LENGTH).optional(),
        school: z.string().max(Config.MAX_STRING_LENGTH),
        education: z.string().max(Config.MAX_STRING_LENGTH),
        graduate: z.string().max(Config.MAX_STRING_LENGTH),
        major: z.string().max(Config.MAX_STRING_LENGTH),
        underrepresented: z.string().max(Config.MAX_STRING_LENGTH),
        hackathonsParticipated: z.string().max(Config.MAX_STRING_LENGTH),
        interestSoftware: z.string().max(Config.MAX_STRING_LENGTH),
        interestHardware: z.string().max(Config.MAX_STRING_LENGTH),
        application1: z.string().max(Config.MAX_ESSAY_LENGTH),
        application2: z.string().max(Config.MAX_ESSAY_LENGTH),
        application3: z.string().max(Config.MAX_ESSAY_LENGTH),
        applicationOptional: z.string().max(Config.MAX_ESSAY_LENGTH).optional(),
        firstHackathonReason: z.string().max(Config.MAX_ESSAY_LENGTH).optional(),
        portfolioLink: z.string().url().max(Config.MAX_PORTFOLIO_URL_LENGTH).optional(),
        eventSuggestions: z.string().max(Config.MAX_ESSAY_LENGTH).optional(),
        pro: z.boolean().optional(),
        attribution: z.array(z.string().max(Config.MAX_STRING_LENGTH)).max(Config.MAX_ARRAY_LENGTH),
        eventInterest: z.array(z.string().max(Config.MAX_STRING_LENGTH)).max(Config.MAX_ARRAY_LENGTH),
        vcInvolvement: z.array(z.string().max(Config.MAX_STRING_LENGTH)).max(Config.MAX_ARRAY_LENGTH),
        hardwareInterest: z.string().max(Config.MAX_ESSAY_LENGTH),
        requestTravelReimbursement: z.boolean(),
        mlhNewsletter: z.boolean(),
    })
    .openapi("RegistrationApplicationSubmittedRequest", {
        example: {
            firstName: "Ronakin",
            lastName: "Kanandini",
            age: "21",
            email: "rpak@gmail.org",
            phoneNumber: "+1 123-456-7890",
            gender: "Prefer Not to Answer",
            race: ["Prefer Not to Answer"],
            country: "United States",
            state: "Illinois",
            school: "University of Illinois Urbana-Champaign",
            education: "Undergraduate University (3+ year)",
            graduate: "Spring 2026",
            major: "Computer science, computer engineering, or software engineering",
            underrepresented: "No",
            hackathonsParticipated: "2-3",
            interestSoftware: "1",
            interestHardware: "2",
            application1: "I love hack",
            application2: "I love hack",
            application3: "I love hack",
            applicationOptional: "",
            pro: true,
            attribution: ["Word of Mouth", "Instagram"],
            eventInterest: ["Meeting New People"],
            vcInvolvement: ["Just curious and want to learn how VC works"],
            hardwareInterest: "Arduino kits and soldering stations",
            requestTravelReimbursement: false,
            mlhNewsletter: true,
        },
    });

export type RegistrationApplicationSubmittedRequest = z.infer<typeof RegistrationApplicationSubmittedRequestSchema>;

export const RegistrationApplicationDraftRequestSchema = RegistrationApplicationSubmittedRequestSchema.partial().openapi(
    "RegistrationApplicationDraftRequest",
    {
        example: {
            firstName: "Ronakin",
            lastName: "Kanandini",
            age: "21",
            email: "rpak@gmail.org",
            gender: "Prefer Not to Answer",
            race: ["Prefer Not to Answer"],
            country: "United States",
            state: "Illinois",
            school: "University of Illinois Urbana-Champaign",
            education: "Undergraduate University (3+ year)",
            graduate: "Spring 2026",
            major: "Computer science, computer engineering, or software engineering",
            underrepresented: "No",
            hackathonsParticipated: "2-3",
            interestSoftware: "1",
            interestHardware: "2",
            vcInvolvement: ["Just curious and want to learn how VC works"],
            hardwareInterest: "Arduino kits and soldering stations",
        },
    },
);

export type RegistrationApplicationDraftRequest = z.infer<typeof RegistrationApplicationDraftRequestSchema>;

export const RegistrationApplicationDraftSchema = RegistrationApplicationDraftRequestSchema.extend({
    userId: UserIdSchema,
}).openapi("RegistrationApplicationDraft", {
    example: {
        ...RegistrationApplicationDraftRequestSchema._def.openapi?.metadata?.example,
        userId: "github1234",
    },
});

export const RegistrationApplicationSubmittedSchema = RegistrationApplicationSubmittedRequestSchema.extend({
    userId: UserIdSchema,
}).openapi("RegistrationApplicationSubmitted", {
    example: {
        ...RegistrationApplicationSubmittedRequestSchema._def.openapi?.metadata?.example,
        userId: "github1234",
    },
});

const MIN_REVIEW_SCORE = 1;
const MAX_REVIEW_SCORE = 5;

export const ApplicationReviewRequestSchema = z
    .object({
        score: z.number().int().min(MIN_REVIEW_SCORE).max(MAX_REVIEW_SCORE),
        comment: z.string().max(Config.MAX_ESSAY_LENGTH).optional(),
    })
    .openapi("ApplicationReviewRequest", {
        example: {
            score: 4,
            comment: "Strong essays, clear interest in the event",
        },
    });

export const ApplicationReviewSchema = ApplicationReviewRequestSchema.extend({
    reviewerId: UserIdSchema,
}).openapi("ApplicationReview", {
    example: {
        reviewerId: "google1234",
        score: 4,
        comment: "Strong essays, clear interest in the event",
    },
});

export const ApplicationReviewsSchema = z.array(ApplicationReviewSchema);

export const ChallengeGradeReportSchema = GradeReportSchema.openapi("ChallengeGradeReport", {
    example: {
        instance: "tier1-03",
        score: 1240,
        totalOrders: 20,
        completed: 14,
        onTime: 11,
        lateMinutes: 12,
        travelMinutes: 187,
        errors: [
            {
                driver: "speedster-1",
                index: 41,
                message: "speedster-1[41]: go to F3 at t=180, earliest possible t=186",
            },
        ],
        coinsEarned: 0,
        coinsSpent: 0,
        powerupErrors: [],
    },
});

const MAX_CHALLENGE_TIER = 3;
export const ChallengeTierNumberSchema = z.coerce.number().int().min(1).max(MAX_CHALLENGE_TIER).openapi("ChallengeTier", {
    example: 2,
    description: "Saloon Mercenary tier: 1, 2 or 3",
});

export const ChallengeTierStatusSchema = z
    .object({
        tier: z.number().int(),
        unlocked: z.boolean(),
        passed: z.boolean(),
        instanceId: z.string(),
        attempts: z.number(),
        bestScore: z.number(),
        normalizedScore: z.number().nullable().openapi({
            description: "bestScore divided by this world's reference score, or null if it isn't calibrated yet",
        }),
        lastReport: ChallengeGradeReportSchema.nullable(),
        nextSubmitAt: z.number().nullable().openapi({
            description: "Epoch ms when the next upload for this tier is allowed, or null if it's allowed now",
        }),
    })
    .openapi("ChallengeTierStatus");
export type ChallengeTierStatus = z.infer<typeof ChallengeTierStatusSchema>;

// The top-level fields describe Tier 1, exactly as in the original (v1) API, so existing clients keep working.
export const RegistrationChallengeStatusSchema = z
    .object({
        instanceId: z.string(),
        attempts: z.number(),
        complete: z.boolean().openapi({ description: "Passed: overallScore reached passRatio" }),
        bestScore: z.number(),
        normalizedScore: z.number().nullable().openapi({
            description: "Tier 1 bestScore divided by the reference score, or null if this instance isn't calibrated yet",
        }),
        passRatio: z.number().openapi({ description: "overallScore needed to pass" }),
        lastReport: ChallengeGradeReportSchema.nullable(),
        overallScore: z.number().nullable().openapi({
            description: "Average normalizedScore over the live tiers (equal to Tier 1's while only Tier 1 is live)",
        }),
        tiers: z.array(ChallengeTierStatusSchema).openapi({ description: "One entry per live tier, in order" }),
    })
    .openapi("RegistrationChallengeStatus", {
        example: {
            instanceId: "tier1-03",
            attempts: 3,
            complete: true,
            bestScore: 1240,
            normalizedScore: 0.87,
            passRatio: 0.6,
            lastReport: null,
            overallScore: 0.87,
            tiers: [
                {
                    tier: 1,
                    unlocked: true,
                    passed: true,
                    instanceId: "tier1-03",
                    attempts: 3,
                    bestScore: 1240,
                    normalizedScore: 0.87,
                    lastReport: null,
                    nextSubmitAt: null,
                },
            ],
        },
    });
export type RegistrationChallengeStatus = z.infer<typeof RegistrationChallengeStatusSchema>;

export const ChallengeLeaderboardQueryLimitSchema = z.coerce
    .number()
    .int()
    .min(1)
    .max(Config.LEADERBOARD_QUERY_LIMIT)
    .openapi("ChallengeLeaderboardQueryLimit", {
        example: 10,
        description: `The number of entries to return. Must be [1, ${Config.LEADERBOARD_QUERY_LIMIT}], inclusive.`,
    });

export const ChallengeLeaderboardSchema = z
    .object({
        entries: z.array(
            z.object({
                rank: z.number().int(),
                overallScore: z.number(),
                tierScores: z.array(z.number().nullable()).openapi({ description: "normalizedScore per live tier" }),
                you: z.boolean().openapi({ description: "True for the requester's own entry" }),
            }),
        ),
        yourRank: z.number().int().nullable().openapi({ description: "Your rank, or null if you have no score yet" }),
        total: z.number().int(),
    })
    .openapi("ChallengeLeaderboard", {
        description: "Anonymous: no names or user ids, only ranks and scores",
        example: {
            /* eslint-disable no-magic-numbers */
            entries: [
                { rank: 1, overallScore: 1.04, tierScores: [1.04], you: false },
                { rank: 2, overallScore: 0.92, tierScores: [0.92], you: true },
            ],
            /* eslint-enable no-magic-numbers */
            yourRank: 2,
            total: 37,
        },
    });
export type ChallengeLeaderboard = z.infer<typeof ChallengeLeaderboardSchema>;

export const RegistrationChallengeWorldSchema = z.unknown().openapi("RegistrationChallengeWorld", {
    description: "The Saloon Mercenary world.json assigned to this user",
});

export const [RegistrationNotFoundError, RegistrationNotFoundErrorSchema] = CreateErrorAndSchema({
    error: "NotFound",
    message: "Couldn't find your registration",
});

export const [NoApplicationsToReviewError, NoApplicationsToReviewErrorSchema] = CreateErrorAndSchema({
    error: "NoApplicationsToReview",
    message: "There are no applications left for you to review",
});

export const [RegistrationMissingProError, RegistrationMissingProErrorSchema] = CreateErrorAndSchema({
    error: "MissingPro",
    message: "You are not registered for this track",
});

export const [RegistrationAlreadySubmittedError, RegistrationAlreadySubmittedErrorSchema] = CreateErrorAndSchema({
    error: "AlreadySubmitted",
    message: "You've already submitted your registration!",
});

export const [RegistrationClosedError, RegistrationClosedErrorSchema] = CreateErrorAndSchema({
    error: "RegistrationClosed",
    message: "Registration is closed, check back next year!",
});

export const [RegistrationChallengeNotFoundError, RegistrationChallengeNotFoundErrorSchema] = CreateErrorAndSchema({
    error: "NoChallengeFound",
    message: "No challenge found. Please request a challenge first.",
});

export const [RegistrationChallengeNoFileError, RegistrationChallengeNoFileErrorSchema] = CreateErrorAndSchema({
    error: "NoFileUploaded",
    message: "Please upload your plan.json",
});

export const [ChallengeTierLockedError, ChallengeTierLockedErrorSchema] = CreateErrorAndSchema({
    error: "TierLocked",
    message: "Pass the earlier tiers to unlock this floor plan.",
});

export const [ChallengeTierNotAvailableError, ChallengeTierNotAvailableErrorSchema] = CreateErrorAndSchema({
    error: "TierNotAvailable",
    message: "That tier isn't open yet",
});

// Like CreateErrorAndSchema, plus how long to wait
export const ChallengeSubmissionTooSoonErrorId = "SubmissionTooSoon";
const SUBMISSION_TOO_SOON_MESSAGE = "You're uploading too fast. Wait a bit before trying this tier again.";
export const ChallengeSubmissionTooSoonErrorSchema = z
    .object({
        error: z.literal(ChallengeSubmissionTooSoonErrorId),
        message: z.literal(SUBMISSION_TOO_SOON_MESSAGE),
        retryAfterSeconds: z.number().int(),
    })
    .openapi({
        example: { error: ChallengeSubmissionTooSoonErrorId, message: SUBMISSION_TOO_SOON_MESSAGE, retryAfterSeconds: 42 },
    });
export function ChallengeSubmissionTooSoonError(
    retryAfterSeconds: number,
): z.infer<typeof ChallengeSubmissionTooSoonErrorSchema> {
    return { error: ChallengeSubmissionTooSoonErrorId, message: SUBMISSION_TOO_SOON_MESSAGE, retryAfterSeconds };
}

// Like CreateErrorAndSchema, plus a per-request `reason` explaining what's wrong with the file
export const RegistrationChallengeInvalidPlanErrorId = "InvalidPlan";
const INVALID_PLAN_MESSAGE = "Your plan.json couldn't be graded";
export const RegistrationChallengeInvalidPlanErrorSchema = z
    .object({
        error: z.literal(RegistrationChallengeInvalidPlanErrorId),
        message: z.literal(INVALID_PLAN_MESSAGE),
        reason: z.string(),
    })
    .openapi({
        example: {
            error: RegistrationChallengeInvalidPlanErrorId,
            message: INVALID_PLAN_MESSAGE,
            reason: 'routes has unknown driver "disguiser-9"',
        },
    });
export function RegistrationChallengeInvalidPlanError(
    reason: string,
): z.infer<typeof RegistrationChallengeInvalidPlanErrorSchema> {
    return { error: RegistrationChallengeInvalidPlanErrorId, message: INVALID_PLAN_MESSAGE, reason };
}
