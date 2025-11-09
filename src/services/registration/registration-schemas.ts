import { prop } from "@typegoose/typegoose";
import { z } from "zod";
import { CreateErrorAndSchema, UserIdSchema } from "../../common/schemas";

export enum Gender {
    MAN = "Man",
    WOMAN = "Woman",
    NONBINARY = "Non-Binary",
    SELF_DESCRIBE = "Prefer to Self-Describe",
    NO_ANSWER = "Prefer Not To Answer",
    PLACEHOLDER = "",
}

export enum Race {
    ASIAN_INDIAN = "Asian Indian",
    BLACK_AFRICAN = "Black or African",
    CHINESE = "Chinese",
    FILIPINO = "Filipino",
    GUAMANIAN_CHAMORRO = "Guamanian or Chamorro",
    HISPANIC_LATINO_SPANISH = "Hispanic / Latino / Spanish Origin",
    JAPANESE = "Japanese",
    KOREAN = "Korean",
    MIDDLE_EASTERN = "Middle Eastern",
    NATIVE_AMERICAN_ALASKAN = "Native American or Alaskan Native",
    NATIVE_HAWAIIAN = "Native Hawaiian",
    SAMOAN = "Samoan",
    VIETNAMESE = "Vietnamese",
    WHITE = "White",
    OTHER_ASIAN = "Other Asian (Thai, Cambodian, etc)",
    OTHER_PACIFIC_ISLANDER = "Other Pacific Islander",
    OTHER = "Other",
    NO_ANSWER = "Prefer Not To Answer",
}

export enum LevelOfStudy {
    LESS_THAN_HIGH_SCHOOL = "Less than Secondary / High School",
    HIGH_SCHOOL = "Secondary / High School",
    UNDERGRAD_2_YEAR = "Undergraduate University (2 year - community college or similar)",
    UNDERGRAD_3_PLUS_YEAR = "Undergraduate University (3+ year)",
    GRADUATE = "Graduate University (Masters, Professional, Doctoral, etc)",
    CODE_SCHOOL = "Code School / Bootcamp",
    VOCATIONAL = "Other Vocational / Trade Program or Apprenticeship",
    POST_DOCTORATE = "Post Doctorate",
    OTHER = "Other",
    NOT_STUDENT = "I'm not currently a student",
    NO_ANSWER = "Prefer not to answer",
}


export enum HackathonExperience {
    ZERO = "0",
    ONE = "1",
    TWO_THREE = "2-3",
    FOUR_PLUS = "4+",
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
const LevelOfStudySchema = z.nativeEnum(LevelOfStudy).openapi("LevelOfStudy");
const HackathonExperienceSchema = z.nativeEnum(HackathonExperience).openapi("HackathonExperience");
const HackInterestSchema = z.nativeEnum(HackInterest).openapi("HackInterest");
const HackOutreachSchema = z.nativeEnum(HackOutreach).openapi("HackOutreach");

export class RegistrationApplicationSubmitted {
    @prop({ required: true, index: true })
    public userId: string;

    @prop({ required: true })
    public firstName: string;

    @prop({ required: true })
    public lastName: string;

    @prop({ required: true })
    public preferredName: string;

    @prop({ required: true })
    public age: number;

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

    @prop({ required: true })
    public countryOfResidence: string;

    @prop({ required: false })
    public stateOfResidence?: string;

    @prop({ required: true })
    public university: string;

    @prop({ required: true })
    public levelOfStudy: LevelOfStudy;

    @prop({ required: true })
    public graduationDate: string;

    @prop({ required: true })
    public major: string;

    @prop({ required: true })
    public underrepresentedGroup: string;

    @prop({ required: true })
    public hackathonExperience: HackathonExperience;

    @prop({ required: true })
    public hackEssay1: string;

    @prop({ required: true })
    public hackEssay2: string;

    @prop({ required: false })
    public optionalEssay?: string;

    @prop({ required: true })
    public proTrackInterest: boolean;

    @prop({ required: false })
    public proQuestion?: string;
    
    public resumeFileName?: string;

    @prop({ required: true })
    public requestedTravelReimbursement: boolean;

    @prop({
        required: true,
        type: String,
        enum: HackOutreach,
    })
    public hackOutreach: HackOutreach[];

    @prop({
        required: true,
        type: String,
        enum: HackInterest,
    })
    public hackInterest: HackInterest[];

    @prop({
        required: true,
        type: () => String,
    })
    public dietaryRestrictions: string[];
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
    public age?: number;

    @prop({ required: false })
    public emailAddress?: string;

    @prop({ required: false })
    public gender?: Gender;

    @prop({
        required: false,
        type: String,
        enum: Race,
    })
    public race?: Race[];

    @prop({ required: false })
    public countryOfResidence?: string;

    @prop({ required: false })
    public stateOfResidence?: string;

    @prop({ required: false })
    public university?: string;

    @prop({ required: false })
    public levelOfStudy?: LevelOfStudy;

    @prop({ required: false })
    public graduationDate?: string;

    @prop({ required: false })
    public major?: string;

    @prop({ required: false })
    public underrepresentedGroup?: string;

    @prop({ required: false })
    public hackathonExperience?: HackathonExperience;

    @prop({ required: false })
    public hackEssay1?: string;

    @prop({ required: false })
    public hackEssay2?: string;

    @prop({ required: false })
    public optionalEssay?: string;

    @prop({ required: false })
    public proTrackInterest?: boolean;

    @prop({ required: false })
    public proQuestion?: string;

    public resumeFileName?: string;

    @prop({ required: false })
    public requestedTravelReimbursement?: boolean;

    @prop({
        required: false,
        type: String,
        enum: HackOutreach,
    })
    public hackOutreach?: HackOutreach[];

    @prop({
        required: false,
        type: String,
        enum: HackInterest,
    })
    public hackInterest?: HackInterest[];

    @prop({
        required: false,
        type: () => String,
    })
    public dietaryRestrictions?: string[];
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
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        preferredName: z.string().optional(),
        age: z.number().optional(),
        // Email address needs to allow empty string as placeholder value. Ideally we change this in the future, but this is a temp fix.
        emailAddress: z.union([z.string().email({ message: "Invalid email syntax." }), z.literal("")]).optional(),
        gender: GenderSchema.optional(),
        race: z.array(RaceSchema).optional(),
        countryOfResidence: z.string().optional(),
        stateOfResidence: z.string().optional(),
        university: z.string().optional(),
        levelOfStudy: LevelOfStudySchema.optional(),
        graduationDate: z.string().optional(),
        major: z.string().optional(),
        underrepresentedGroup: z.string().optional(),
        hackathonExperience: HackathonExperienceSchema.optional(),
        hackEssay1: z.string().optional(),
        hackEssay2: z.string().optional(),
        optionalEssay: z.string().optional(),
        proTrackInterest: z.boolean().optional(),
        proQuestion: z.string().optional(),
        resumeFileName: z.string().optional(),
        requestedTravelReimbursement: z.boolean().optional(),
        hackOutreach: z.array(HackOutreachSchema).optional(),
        hackInterest: z.array(HackInterestSchema).optional(),
        dietaryRestrictions: z.array(z.string()).optional(),
    })
    .openapi("RegistrationApplicationDraftRequest", {
        example: {
            firstName: "Ronakin",
            lastName: "Kanandini",
            preferredName: "Ron",
            age: 20,
            emailAddress: "rpak@gmail.org",
            university: "University of Illinois Urbana-Champaign",
            hackEssay1: "I love hack",
            hackEssay2: "I love hack",
            optionalEssay: "",
            resumeFileName: "https://www.google.com",
            countryOfResidence: "United States",
            stateOfResidence: "Illinois",
            gender: Gender.NO_ANSWER,
            levelOfStudy: LevelOfStudy.UNDERGRAD_3_PLUS_YEAR,
            major: "Computer Science",
            graduationDate: "Spring 2026",
            underrepresentedGroup: "Yes",
            hackathonExperience: HackathonExperience.ONE,
            proTrackInterest: true,
            proQuestion: "I wanna be a Knight",
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
        firstName: z.string(),
        lastName: z.string(),
        preferredName: z.string(),
        age: z.number(),
        // Email address needs to allow empty string as placeholder value. Ideally we change this in the future, but this is a temp fix.
        emailAddress: z.union([z.string().email({ message: "Invalid email syntax." }), z.literal("")]),
        gender: GenderSchema,
        race: z.array(RaceSchema),
        countryOfResidence: z.string(),
        stateOfResidence: z.string().optional(),
        university: z.string(),
        levelOfStudy: LevelOfStudySchema,
        graduationDate: z.string(),
        major: z.string(),
        underrepresentedGroup: z.string(),
        hackathonExperience: HackathonExperienceSchema,
        hackEssay1: z.string(),
        hackEssay2: z.string(),
        optionalEssay: z.string().optional(),
        proTrackInterest: z.boolean(),
        proQuestion: z.string().optional(),
        resumeFileName: z.string().optional(),
        requestedTravelReimbursement: z.boolean(),
        hackOutreach: z.array(HackOutreachSchema),
        hackInterest: z.array(HackInterestSchema),
        dietaryRestrictions: z.array(z.string()),
    })
    .openapi("RegistrationApplicationSubmittedRequest", {
        example: {
            firstName: "Ronakin",
            lastName: "Kanandini",
            preferredName: "Ron",
            age: 20,
            emailAddress: "rpak@gmail.org",
            university: "University of Illinois Urbana-Champaign",
            hackEssay1: "I love hack",
            hackEssay2: "I love hack",
            optionalEssay: "",
            resumeFileName: "https://www.google.com",
            countryOfResidence: "United States",
            stateOfResidence: "Illinois",
            gender: Gender.NO_ANSWER,
            levelOfStudy: LevelOfStudy.UNDERGRAD_3_PLUS_YEAR,
            major: "Computer Science",
            graduationDate: "Spring 2026",
            underrepresentedGroup: "Yes",
            hackathonExperience: HackathonExperience.ONE,
            proTrackInterest: true,
            proQuestion: "I wanna be a Knight",
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
