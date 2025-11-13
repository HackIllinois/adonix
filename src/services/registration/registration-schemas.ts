import { prop } from "@typegoose/typegoose";
import { z } from "zod";
import { CreateErrorAndSchema, UserIdSchema } from "../../common/schemas";

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

    @prop({ required: false })
    public applicationOptional?: string;

    @prop({ required: false })
    public applicationPro?: string;

    @prop({ required: true })
    public attribution: string;

    @prop({ required: true })
    public eventInterest: string;

    @prop({ required: true })
    requestTravelReimbursement: boolean;
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
    public applicationOptional?: string;

    @prop({ required: false })
    public applicationPro?: string;

    @prop({ required: false })
    public attribution?: string;

    @prop({ required: false })
    public eventInterest?: string;

    @prop({ required: false })
    requestTravelReimbursement?: boolean;
}

export class RegistrationChallenge {
    @prop({ required: true, index: true })
    public userId: string;

    @prop({ required: true, type: () => Number })
    public people: Map<string, number>;

    @prop({ required: true, type: () => [[String]] })
    public alliances: string[][];

    @prop({ required: true })
    public solution: number;

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
        firstName: z.string(),
        lastName: z.string(),
        preferredName: z.string().optional(),
        age: z.string(),
        email: z.string().email({ message: "Invalid email." }),
        gender: z.string(),
        race: z.array(z.string()),
        country: z.string(),
        state: z.string().optional(),
        school: z.string(),
        education: z.string(),
        graduate: z.string(),
        major: z.string(),
        underrepresented: z.string(),
        hackathonsParticipated: z.string(),
        application1: z.string(),
        application2: z.string(),
        applicationOptional: z.string().optional(),
        applicationPro: z.string().optional(),
        attribution: z.string(),
        eventInterest: z.string(),
        requestTravelReimbursement: z.boolean(),
    })
    .openapi("RegistrationApplicationSubmittedRequest", {
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
            application1: "I love hack",
            application2: "I love hack",
            applicationOptional: "",
            applicationPro: "I wanna be a Pro",
            attribution: "Word of Mouth",
            eventInterest: "Meeting New People",
            requestTravelReimbursement: false,
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

export const RegistrationChallengeStatusSchema = z
    .object({
        people: z.record(z.string(), z.number()),
        alliances: z.array(z.array(z.string())),
        attempts: z.number(),
        complete: z.boolean(),
    })
    .openapi("RegistrationChallengeInput", {
        example: {
            people: {
                Zeus: 36,
                Apollo: 32,
                Athena: 34,
                Hades: 28,
                Hermes: 29,
                Artemis: 30,
            },
            alliances: [
                ["Zeus", "Apollo"],
                ["Apollo", "Athena"],
                ["Hades", "Hermes"],
                ["Hermes", "Artemis"],
                ["Hades", "Artemis"],
            ],
            attempts: 3,
            complete: false,
        },
    });

export const RegistrationChallengeSolveSchema = z
    .object({
        solution: z.number().openapi({ example: 123 }),
    })
    .openapi("RegistrationChallengeSolve");

export const [RegistrationNotFoundError, RegistrationNotFoundErrorSchema] = CreateErrorAndSchema({
    error: "NotFound",
    message: "Couldn't find your registration",
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

export const [RegisterationIncompleteSubmissionError, RegisterationIncompleteSubmissionErrorSchema] = CreateErrorAndSchema({
    error: "IncompleteApplication",
    message: "Your application is incomplete. Please fill out all required fields before submitting.",
});
