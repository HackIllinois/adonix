import { index, prop } from "@typegoose/typegoose";
import { z } from "zod";
import { CreateErrorAndSchema, UserIdSchema } from "../../common/schemas";
import Config from "../../common/config";

export class ApplicationReview {
    @prop({ required: true })
    public reviewerId: string;

    // null = assigned to the reviewer but not yet scored
    @prop({ type: Number, default: null })
    public score: number | null;
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

export class RegistrationChallenge {
    @prop({ required: true, index: true })
    public userId: string;

    @prop({ required: true })
    public inputFileId: string;

    @prop({ required: true })
    public attempts: number;

    @prop({ required: true })
    public complete: boolean;
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
    })
    .openapi("ApplicationReviewRequest", {
        example: {
            score: 4,
        },
    });

export const RegistrationChallengeStatusSchema = z
    .object({
        inputFileId: z.string(),
        attempts: z.number(),
        complete: z.boolean(),
    })
    .openapi("RegistrationChallengeStatus", {
        example: {
            inputFileId: "abc123",
            attempts: 3,
            complete: false,
        },
    });

export const RegistrationChallengeSolveSchema = z
    .object({
        fileId: z.string().openapi({ example: "uploaded_file_id" }),
    })
    .openapi("RegistrationChallengeSolve");

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

export const [RegistrationChallengeSolveFailedError, RegistrationChallengeSolveFailedErrorSchema] = CreateErrorAndSchema({
    error: "IncorrectSolution",
    message: "That's not the correct answer, try again!",
});

export const [RegistrationChallengeAlreadySolvedError, RegistrationChallengeAlreadySolvedErrorSchema] = CreateErrorAndSchema({
    error: "AlreadySolved",
    message: "You've already solved the challenge!",
});
