import { index, modelOptions, prop } from "@typegoose/typegoose";
import { z } from "zod";
import { CreateErrorAndSchema, UserIdSchema } from "../../common/schemas";
import Config from "../../common/config";
import { GradeReportSchema } from "./dispatch/dispatch-schemas";

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

    @prop({ required: true })
    public application1: string;

    @prop({ required: true })
    public application2: string;

    @prop({ required: true })
    public application3: string;

    @prop({ required: false })
    public applicationOptional?: string;

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
    public application1?: string;

    @prop({ required: false })
    public application2?: string;

    @prop({ required: false })
    public application3?: string;

    @prop({ required: false })
    public applicationOptional?: string;

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
    public delivered: number;

    @prop({ required: true })
    public onTime: number;

    @prop({ required: true })
    public lateMinutes: number;

    @prop({ required: true })
    public travelMinutes: number;

    // Called `errors` in the API, but that name is reserved by mongoose
    @prop({ required: true, type: () => [ChallengeRouteError] })
    public routeErrors: ChallengeRouteError[];
}

export class RegistrationChallenge {
    @prop({ required: true, index: true })
    public userId: string;

    // Dispatch Rush world assigned to this user, see DISPATCH_INSTANCES in challenge-lib
    @prop({ required: true })
    public instanceId: string;

    @prop({ required: true })
    public attempts: number;

    // True once bestScore reaches the pass ratio. Never goes back to false.
    @prop({ required: true })
    public complete: boolean;

    @prop({ default: 0 })
    public bestScore?: number;

    @prop({ required: false, type: () => ChallengeGradeReport })
    public lastReport?: ChallengeGradeReport;
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
        application1: z.string().max(Config.MAX_ESSAY_LENGTH),
        application2: z.string().max(Config.MAX_ESSAY_LENGTH),
        application3: z.string().max(Config.MAX_ESSAY_LENGTH),
        applicationOptional: z.string().max(Config.MAX_ESSAY_LENGTH).optional(),
        pro: z.boolean().optional(),
        attribution: z.array(z.string().max(Config.MAX_STRING_LENGTH)).max(Config.MAX_ARRAY_LENGTH),
        eventInterest: z.array(z.string().max(Config.MAX_STRING_LENGTH)).max(Config.MAX_ARRAY_LENGTH),
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
            application1: "I love hack",
            application2: "I love hack",
            application3: "I love hack",
            applicationOptional: "",
            pro: true,
            attribution: ["Word of Mouth", "Instagram"],
            eventInterest: ["Meeting New People"],
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
        totalOrders: 15,
        delivered: 14,
        onTime: 11,
        lateMinutes: 12,
        travelMinutes: 187,
        errors: [{ driver: "car-1", index: 41, message: "car-1[41]: go to H3 at t=180, earliest possible t=186" }],
    },
});

export const RegistrationChallengeStatusSchema = z
    .object({
        instanceId: z.string(),
        attempts: z.number(),
        complete: z.boolean(),
        bestScore: z.number(),
        normalizedScore: z.number().nullable().openapi({
            description: "bestScore divided by the reference score, or null if this instance isn't calibrated yet",
        }),
        passRatio: z.number().openapi({ description: "normalizedScore needed to pass" }),
        lastReport: ChallengeGradeReportSchema.nullable(),
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
        },
    });
export type RegistrationChallengeStatus = z.infer<typeof RegistrationChallengeStatusSchema>;

export const RegistrationChallengeWorldSchema = z.unknown().openapi("RegistrationChallengeWorld", {
    description: "The Dispatch Rush world.json assigned to this user",
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
            reason: 'routes has unknown driver "bike-9"',
        },
    });
export function RegistrationChallengeInvalidPlanError(
    reason: string,
): z.infer<typeof RegistrationChallengeInvalidPlanErrorSchema> {
    return { error: RegistrationChallengeInvalidPlanErrorId, message: INVALID_PLAN_MESSAGE, reason };
}
