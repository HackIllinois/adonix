import { prop } from "@typegoose/typegoose";
import { z } from "zod";
import { ReviewScoreSchema } from "../registration/registration-schemas";
import Config from "../../common/config";
import { CreateErrorAndSchema, UserIdSchema } from "../../common/schemas";

export enum DecisionStatus {
    TBD = "TBD",
    ACCEPTED = "ACCEPTED",
    REJECTED = "REJECTED",
    WAITLISTED = "WAITLISTED",
}

export enum DecisionResponse {
    PENDING = "PENDING",
    ACCEPTED = "ACCEPTED",
    DECLINED = "DECLINED",
}

export class AdmissionDecision {
    @prop({ required: true, index: true })
    public userId: string;

    @prop({ required: true, index: true })
    public status: DecisionStatus;

    @prop({ default: false })
    public admittedPro: boolean;

    @prop({ default: DecisionResponse.PENDING, index: true })
    public response: DecisionResponse;

    @prop({ default: false })
    public emailSent: boolean;

    @prop({ default: 0 })
    public reimbursementValue: number;

    @prop({ default: false })
    public correctProChallenge: boolean;

    // Best Pro challenge score divided by the reference solver's score (1.0 = matched our solver)
    @prop({ default: 0 })
    public proChallengeScore: number;
}

export class ApplicationReviewAssignment {
    // The reviewer ID is the primary key, so there can only be one active assignment per reviewer.
    @prop({ required: true, type: String })
    public _id: string;

    @prop({ required: true })
    public userId: string;

    @prop({ required: true })
    public reviewCount: number;
}

export const DecisionStatusSchema = z.nativeEnum(DecisionStatus);
export const DecisionResponseSchema = z.nativeEnum(DecisionResponse);

export const AdmissionDecisionSchema = z
    .object({
        userId: UserIdSchema,
        status: DecisionStatusSchema,
        admittedPro: z.boolean().openapi({ example: false }),
        response: DecisionResponseSchema,
        emailSent: z.boolean().openapi({ example: false }),
        reimbursementValue: z.number(),
        correctProChallenge: z.boolean().openapi({ example: false }),
        proChallengeScore: z.number().openapi({ example: 0.87 }),
    })
    .openapi("AdmissionDecision");

export const AdmissionDecisionsSchema = z.array(AdmissionDecisionSchema);

export const AdmissionDecisionUpdateSchema = AdmissionDecisionSchema.pick({
    userId: true,
    status: true,
    admittedPro: true,
    reimbursementValue: true,
})
    .openapi("AdmissionDecisionUpdate")
    .refine((decision) => decision.status !== DecisionStatus.TBD, {
        message: "TBD is not a valid update status",
    });
export const AdmissionDecisionUpdatesSchema = z.array(AdmissionDecisionUpdateSchema);

export const ApplicationReviewSummarySchema = z
    .object({
        userId: UserIdSchema,
        reviewCount: z.number().openapi({ example: 3 }),
        averageScore: z.number().nullable().openapi({ example: 4.33 }),
    })
    .openapi("ApplicationReviewSummary");

export type ApplicationReviewSummary = z.infer<typeof ApplicationReviewSummarySchema>;

export const ApplicationReviewSummariesSchema = z.array(ApplicationReviewSummarySchema);

export enum ApplicantTag {
    IN_REVIEW = "IN_REVIEW",
    ADMITTED = "ADMITTED",
    ADMITTED_REIMBURSED = "ADMITTED_REIMBURSED",
    WAITLISTED = "WAITLISTED",
    REJECTED = "REJECTED",
}

export const ApplicantTagSchema = z.nativeEnum(ApplicantTag).openapi("ApplicantTag");

// "none" in the reviewerId filter means applications with no reviewers
export const NO_REVIEWERS_FILTER = "none";

export const ApplicantsQuerySchema = z.object({
    tag: ApplicantTagSchema.optional(),
    reviewerId: z
        .string()
        .optional()
        .openapi({ description: `A reviewer's user ID, or "${NO_REVIEWERS_FILTER}" for no reviewers` }),
});

export const ApplicantsEmailsQuerySchema = z.object({
    tag: ApplicantTagSchema,
});

export const ApplicantSchema = z
    .object({
        userId: UserIdSchema,
        name: z.string().openapi({ example: "Ada Lovelace" }),
        email: z.string().openapi({ example: "ada@example.org" }),
        school: z.string().openapi({ example: "University of Illinois Urbana-Champaign" }),
        reviewers: z.array(
            z.object({
                reviewerId: UserIdSchema,
                name: z
                    .string()
                    .nullable()
                    .openapi({ description: "The reviewer's name, or null if unknown", example: "Rae Reviewer" }),
                score: ReviewScoreSchema.nullable(),
            }),
        ),
        aiScore: ReviewScoreSchema.nullable(),
        finalScore: ReviewScoreSchema.nullable(),
        edited: z.boolean().openapi({ example: false }),
        aiGradeFailed: z.boolean().openapi({
            description: "AI grading failed and the application has no AI score",
            example: false,
        }),
        tag: ApplicantTagSchema,
    })
    .openapi("Applicant");

export type Applicant = z.infer<typeof ApplicantSchema>;

export const ApplicantsSchema = z.array(ApplicantSchema);

export const ApplicantEmailsSchema = z
    .object({
        emails: z.array(z.string()).openapi({ example: ["ada@example.org"] }),
    })
    .openapi("ApplicantEmails");

export const ApplicantTagUpdateRequestSchema = z
    .object({
        tag: ApplicantTagSchema,
        reimbursementValue: z
            .number()
            .positive()
            .optional()
            .openapi({ example: 100, description: "Required (greater than 0) for ADMITTED_REIMBURSED, ignored for other tags" }),
    })
    .openapi("ApplicantTagUpdateRequest")
    .refine((request) => request.tag !== ApplicantTag.ADMITTED_REIMBURSED || request.reimbursementValue !== undefined, {
        message: "reimbursementValue is required for ADMITTED_REIMBURSED",
        path: ["reimbursementValue"],
    });

export const ApplicantTagUpdateResponseSchema = AdmissionDecisionSchema.extend({
    tag: ApplicantTagSchema,
}).openapi("ApplicantTagUpdateResponse");

export const ApplicationReviewerRequestSchema = z
    .object({
        reviewerId: UserIdSchema,
    })
    .openapi("ApplicationReviewerRequest");

export const [ReviewAlreadyScoredError, ReviewAlreadyScoredErrorSchema] = CreateErrorAndSchema({
    error: "ReviewAlreadyScored",
    message: "This reviewer has already scored the application, so they cannot be removed",
});

export const AiGradeRequestSchema = z
    .object({
        limit: z
            .number()
            .int()
            .min(1)
            .max(Config.AI_GRADE_MAX_LIMIT)
            .default(Config.AI_GRADE_DEFAULT_LIMIT)
            .openapi({ example: 25 }),
        dryRun: z.boolean().default(true).openapi({ example: true }),
    })
    .openapi("AiGradeRequest");

export const AiGradeResponseSchema = z
    .object({
        graded: z.number().int().openapi({ example: 24 }),
        failed: z.number().int().openapi({ example: 1 }),
        skipped: z.number().int().openapi({ description: "Applications already graded by AI", example: 10 }),
        dryRun: z.boolean().openapi({ example: false }),
        retried: z.number().int().openapi({
            description: "Applications picked again in this run because an earlier attempt failed",
            example: 2,
        }),
        gaveUp: z.number().int().openapi({
            description: "Ungraded applications that reached the maximum failed attempts and are never picked again",
            example: 1,
        }),
        userIds: z.array(UserIdSchema).openapi({ description: "Graded (or, in a dry run, would-be graded) users" }),
    })
    .openapi("AiGradeResponse");

export const [AiGradingNotConfiguredError, AiGradingNotConfiguredErrorSchema] = CreateErrorAndSchema({
    error: "AiGradingNotConfigured",
    message: "LUMEN_API_KEY, LUMEN_BASE_URL and LUMEN_MODEL must be set to grade with AI",
});

export const [DecisionNotAcceptedError, DecisionNotAcceptedErrorSchema] = CreateErrorAndSchema({
    error: "NotAccepted",
    message: "You weren't accepted, you cannot accept/decline this decision",
});

export const [DecisionAlreadyRSVPdError, DecisionAlreadyRSVPdErrorSchema] = CreateErrorAndSchema({
    error: "AlreadyRSVPed",
    message: "You've already RSVPed!",
});

export const [DecisionNotFoundError, DecisionNotFoundErrorSchema] = CreateErrorAndSchema({
    error: "DecisionNotFound",
    message: "Couldn't find your decision!",
});

export const [ProfileDataRequiredError, ProfileDataRequiredErrorSchema] = CreateErrorAndSchema({
    error: "ProfileDataRequired",
    message: "Profile data is required when accepting admission",
});
