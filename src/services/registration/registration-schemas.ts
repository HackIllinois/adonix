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

export class RegistrationApplication {
    @prop({ required: true })
    public userId: string;

    @prop({ default: false })
    public hasSubmitted: boolean;

    @prop({ required: true })
    public isProApplicant: boolean;

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

export const RegistrationStatusSchema = z
    .object({
        alive: z.boolean(),
    })
    .openapi("RegistrationStatus", {
        description: "If registration is currently open or not",
    });

export const RegistrationApplicationRequestSchema = z
    .object({
        isProApplicant: z.boolean(),
        preferredName: z.string(),
        legalName: z.string(),
        emailAddress: z.string(),
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
    .openapi("RegistrationApplicationRequest", {
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
            isProApplicant: true,
            proEssay: "I wanna be a Knight",
            considerForGeneral: true,
            requestedTravelReimbursement: false,
            dietaryRestrictions: ["Vegetarian"],
            race: [Race.NO_ANSWER],
            hackInterest: [HackInterest.MEETING_PEOPLE],
            hackOutreach: [HackOutreach.INSTAGRAM],
        },
    });

export type RegistrationApplicationRequest = z.infer<typeof RegistrationApplicationRequestSchema>;

export const RegistrationApplicationSchema = RegistrationApplicationRequestSchema.extend({
    userId: UserIdSchema,
    hasSubmitted: z.boolean(),
}).openapi("RegistrationApplication", {
    example: {
        ...RegistrationApplicationRequestSchema._def.openapi?.metadata?.example,
        userId: "github1234",
        hasSubmitted: false,
    },
});

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
