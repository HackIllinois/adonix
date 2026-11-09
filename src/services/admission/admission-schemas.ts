import { prop } from "@typegoose/typegoose";
import { z } from "zod";
import { ReviewScoreSchema } from "../registration/registration-schemas";
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
                score: ReviewScoreSchema.nullable(),
            }),
        ),
        aiScore: ReviewScoreSchema.nullable(),
        finalScore: ReviewScoreSchema.nullable(),
        edited: z.boolean().openapi({ example: false }),
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

export const ApplicationReviewerRequestSchema = z
    .object({
        reviewerId: UserIdSchema,
    })
    .openapi("ApplicationReviewerRequest");

export const [ReviewAlreadyScoredError, ReviewAlreadyScoredErrorSchema] = CreateErrorAndSchema({
    error: "ReviewAlreadyScored",
    message: "This reviewer has already scored the application, so they cannot be removed",
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
