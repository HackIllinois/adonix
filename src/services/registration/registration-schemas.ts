import { prop } from "@typegoose/typegoose";
import { z } from "zod";
import { CreateErrorAndSchema, UserIdSchema } from "../../common/schemas";

export enum Gender {
    MALE = "Male",
    FEMALE = "Female",
    NONBINARY = "Non-Binary",
    OTHER = "Other",
    NO_ANSWER = "Prefer Not To Answer",
    PLACEHOLDER = "",
}

export enum Race {
    AMERICAN_INDIAN_ALASKA_NATIVE = "American Indian or Alaska Native",
    ARAB_MIDDLE_EASTERN = "Arab or Middle Eastern",
    BLACK_AFRICAN_AMERICAN = "Black or African American",
    EAST_ASIAN = "East Asian",
    HISPANIC_LATINO = "Hispanic or Latino",
    PACIFIC_ISLANDER = "Native Hawaiian or Pacific Islander",
    SOUTH_EAST_ASIAN = "South East Asian",
    SOUTH_ASIAN = "South Asian",
    WHITE = "White",
    OTHER = "Other",
    NO_ANSWER = "Prefer Not To Answer",
}

export enum Degree {
    ASSOCIATES = "Associates' Degree",
    BACHELORS = "Bachelors' Degree ",
    MASTERS = "Masters' Degree",
    PHD = "PhD",
    GRADUATED = "Graduated",
    OTHER = "Other",
    NOT_APPLICABLE = "N/A",
    PLACEHOLDER = "",
}

export enum HackInterest {
    TECHNICAL_WORKSHOPS = "Attending technical workshops",
    PRIZES = "Submitting a project to win prizes",
    MINI_EVENTS = "Participating in mini-events",
    MEETING_PEOPLE = "Meeting new people",
    MENTORS = "Working with mentors to get feedback",
    COMPANIES_NETWORKING = "Company Q&As and networking events",
    OTHER = "OTHER",
}

export enum HackOutreach {
    INSTAGRAM = "Instagram",
    TWITTER = "Twitter/X",
    TIKTOK = "TikTok",
    DISCORD = "Discord",
    FACEBOOK = "Facebook",
    LINKEDIN = "LinkedIn",
    REDDIT = "Reddit",
    WORD_OF_MOUTH = "Word of Mouth",
    CS_DEPT_EMAL = "CS Department Email",
    POSTERS = "Posters/Flyers on Campus",
    SLACK = "Slack",
    NEWSLETTER = "HackIllinois Newsletter",
    OTHER = "OTHER",
}

const GenderSchema = z.nativeEnum(Gender).openapi("Gender");
const RaceSchema = z.nativeEnum(Race).openapi("Race");
const DegreeSchema = z.nativeEnum(Degree).openapi("Degree");
const HackInterestSchema = z.nativeEnum(HackInterest).openapi("HackInterest");
const HackOutreachSchema = z.nativeEnum(HackOutreach).openapi("HackOutreach");

export class RegistrationApplicationSubmitted {
    @prop({ required: true, index: true })
    public userId: string;

    @prop({ required: true })
    public preferredName: string;

    @prop({ required: true })
    public legalName: string;

    @prop({ required: true })
    public emailAddress: string;

    @prop({ required: true })
    public gender: Gender;

    @prop({
        required: true,
        type: String,
        enum: Race,
    })
    public race: Race[];

    // Not required
    public resumeFileName?: string;

    @prop({ required: true })
    public requestedTravelReimbursement: boolean;

    @prop({ required: true })
    public location: string;

    @prop({ required: true })
    public degree: Degree;

    @prop({ required: true })
    public major: string;

    @prop({ required: false })
    public minor?: string;

    @prop({ required: true })
    public university: string;

    @prop({ required: true })
    public gradYear: number;

    @prop({
        required: true,
        type: String,
        enum: HackInterest,
    })
    public hackInterest: HackInterest[];

    @prop({
        required: true,
        type: String,
        enum: HackOutreach,
    })
    public hackOutreach: HackOutreach[];

    @prop({
        required: true,
        type: () => String,
    })
    public dietaryRestrictions: string[];

    @prop({ required: true })
    public hackEssay1: string;

    @prop({ required: true })
    public hackEssay2: string;

    @prop({ required: true })
    public optionalEssay?: string;

    @prop({ required: false })
    proEssay?: string;

    @prop({ required: false })
    considerForGeneral?: boolean;
}

export class RegistrationApplicationDraft {
    @prop({ required: true, index: true })
    public userId: string;

    @prop({ required: true })
    public preferredName: string;

    @prop({ required: true })
    public legalName: string;

    @prop({ required: true })
    public emailAddress: string;

    @prop({ required: true })
    public gender: Gender;

    @prop({
        required: false,
        type: String,
        enum: Race,
    })
    public race: Race[];

    // Not required
    public resumeFileName?: string;

    @prop({ required: false })
    public requestedTravelReimbursement: boolean;

    @prop({ required: false })
    public location: string;

    @prop({ required: false })
    public degree: Degree;

    @prop({ required: false })
    public major: string;

    @prop({ required: false })
    public minor?: string;

    @prop({ required: false })
    public university: string;

    @prop({ required: false })
    public gradYear: number;

    @prop({
        required: false,
        type: String,
        enum: HackInterest,
    })
    public hackInterest: HackInterest[];

    @prop({
        required: false,
        type: String,
        enum: HackOutreach,
    })
    public hackOutreach: HackOutreach[];

    @prop({
        required: false,
        type: () => String,
    })
    public dietaryRestrictions: string[];

    @prop({ required: false })
    public hackEssay1: string;

    @prop({ required: false })
    public hackEssay2: string;

    @prop({ required: false })
    public optionalEssay?: string;

    @prop({ required: false })
    proEssay?: string;

    @prop({ required: false })
    considerForGeneral?: boolean;
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

export const RegistrationApplicationDraftRequestSchema = z
    .object({
        preferredName: z.string(),
        legalName: z.string(),
        // Email address needs to allow empty string as placeholder value. Ideally we change this in the future, but this is a temp fix.
        emailAddress: z.union([z.string().email({ message: "Invalid email syntax." }), z.literal("")]),
        gender: GenderSchema,
        race: z.array(RaceSchema).optional(),
        resumeFileName: z.string().optional(),
        requestedTravelReimbursement: z.boolean().optional(),
        location: z.string().optional(),
        degree: DegreeSchema.optional(),
        major: z.string().optional(),
        minor: z.string().optional(),
        university: z.string().optional(),
        gradYear: z.number().optional(),
        hackInterest: z.array(HackInterestSchema).optional(),
        hackOutreach: z.array(HackOutreachSchema).optional(),
        dietaryRestrictions: z.array(z.string()).optional(),
        hackEssay1: z.string().optional(),
        hackEssay2: z.string().optional(),
        optionalEssay: z.string().optional(),
        proEssay: z.string().optional(),
        considerForGeneral: z.boolean().optional(),
    })
    .openapi("RegistrationApplicationDraftRequest", {
        example: {
            preferredName: "Ronakin",
            legalName: "Ronakin Kanandini",
            emailAddress: "rpak@gmail.org",
            university: "University of Illinois Urbana-Champaign",
            hackEssay1: "I love hack",
            hackEssay2: "I love hack",
            optionalEssay: "",
            resumeFileName: "https://www.google.com",
            location: "Urbana",
            gender: Gender.NO_ANSWER,
            degree: Degree.ASSOCIATES,
            major: "Computer Science",
            gradYear: 0,
            proEssay: "I wanna be a Knight",
            considerForGeneral: true,
            requestedTravelReimbursement: false,
            dietaryRestrictions: ["Vegetarian"],
            race: [Race.NO_ANSWER],
            hackInterest: [HackInterest.MEETING_PEOPLE],
            hackOutreach: [HackOutreach.INSTAGRAM],
        },
    });

export type RegistrationApplicationDraftRequest = z.infer<typeof RegistrationApplicationDraftRequestSchema>;

export const RegistrationApplicationSubmittedRequestSchema = z
    .object({
        preferredName: z.string(),
        legalName: z.string(),
        // Email address needs to allow empty string as placeholder value. Ideally we change this in the future, but this is a temp fix.
        emailAddress: z.union([z.string().email({ message: "Invalid email syntax." }), z.literal("")]),
        gender: GenderSchema,
        race: z.array(RaceSchema),
        resumeFileName: z.string().optional(),
        requestedTravelReimbursement: z.boolean(),
        location: z.string(),
        degree: DegreeSchema,
        major: z.string(),
        minor: z.string().optional(),
        university: z.string(),
        gradYear: z.number(),
        hackInterest: z.array(HackInterestSchema),
        hackOutreach: z.array(HackOutreachSchema),
        dietaryRestrictions: z.array(z.string()),
        hackEssay1: z.string(),
        hackEssay2: z.string(),
        optionalEssay: z.string().optional(),
        proEssay: z.string().optional(),
        considerForGeneral: z.boolean().optional(),
    })
    .openapi("RegistrationApplicationSubmittedRequest", {
        example: {
            preferredName: "Ronakin",
            legalName: "Ronakin Kanandini",
            emailAddress: "rpak@gmail.org",
            university: "University of Illinois Urbana-Champaign",
            hackEssay1: "I love hack",
            hackEssay2: "I love hack",
            optionalEssay: "",
            resumeFileName: "https://www.google.com",
            location: "Urbana",
            gender: Gender.NO_ANSWER,
            degree: Degree.ASSOCIATES,
            major: "Computer Science",
            gradYear: 0,
            proEssay: "I wanna be a Knight",
            considerForGeneral: true,
            requestedTravelReimbursement: false,
            dietaryRestrictions: ["Vegetarian"],
            race: [Race.NO_ANSWER],
            hackInterest: [HackInterest.MEETING_PEOPLE],
            hackOutreach: [HackOutreach.INSTAGRAM],
        },
    });

export type RegistrationApplicationSubmittedRequest = z.infer<typeof RegistrationApplicationSubmittedRequestSchema>;

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

export const [RegistrationDraftAlreadyExistsError, RegistrationDraftAlreadyExistsErrorSchema] = CreateErrorAndSchema({
    error: "RegistrationDraftAlreadyExists",
    message: "Registration draft already exists. Try editing existing draft.",
});

export const [RegistrationDraftNotFoundError, RegistrationDraftNotFoundErrorSchema] = CreateErrorAndSchema({
    error: "RegistrationDraftNotFound",
    message: "Registration draft not found.",
});
