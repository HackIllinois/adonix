import { modelOptions, prop } from "@typegoose/typegoose";
import { z } from "zod";
import Config from "../../common/config";
import { CreateErrorAndSchema, UserIdSchema } from "../../common/schemas";

@modelOptions({ schemaOptions: { _id: false } })
export class DuelStats {
    @prop({ required: true, default: 0 })
    public duelsPlayed: number;

    @prop({ required: true, default: 0 })
    public uniqueDuelsPlayed: number;

    @prop({ required: true, default: 0 })
    public duelsWon: number;
}

export const DuelStatsSchema = z.object({
    duelsPlayed: z.number().default(0),
    uniqueDuelsPlayed: z.number().default(0),
    duelsWon: z.number().default(0),
});
export class AttendeeProfile {
    @prop({ required: true, index: true })
    public userId: string;

    @prop({ required: true })
    public displayName: string;

    @prop({ required: true })
    public avatarUrl: string;

    @prop({ required: true })
    public discordTag: string;

    @prop({ required: true })
    public points: number;

    // Points accumulated over all time, does not decrease with purchases
    @prop({ required: true })
    public pointsAccumulated: number;

    @prop({ required: true })
    public foodWave: number;

    @prop({ required: true, type: String })
    public dietaryRestrictions: string[];

    @prop({ required: true })
    public shirtSize: string;

    @prop({ required: false })
    public team?: string;

    @prop({ required: false })
    public tier?: string;

    @prop({ required: false, type: () => DuelStats, default: () => ({}) })
    public duelStats?: DuelStats;
}

export const AttendeeProfileSchema = z
    .object({
        userId: UserIdSchema,
        displayName: z.string(),
        avatarUrl: z.string(),
        discordTag: z.string(),
        points: z.number(),
        pointsAccumulated: z.number(),
        foodWave: z.number(),
        dietaryRestrictions: z.array(z.string()),
        shirtSize: z.string(),
        team: z.string().optional(),
        tier: z.string().optional(),
        duelStats: DuelStatsSchema.optional(),
    })
    .openapi("AttendeeProfile", {
        example: {
            userId: "google12345",
            displayName: "Bob The Great",
            discordTag: "hackillinois",
            avatarUrl: "https://raw.githubusercontent.com/HackIllinois/adonix-metadata/main/avatars/goblin.png",
            points: 23,
            pointsAccumulated: 104,
            foodWave: 1,
            dietaryRestrictions: ["Peanut Allergy"],
            shirtSize: "M",
            team: "Alpha",
            tier: "Gold",
        },
    });

export const ProfileLeaderboardQueryLimitSchema = z.coerce
    .number()
    .min(1)
    .max(Config.LEADERBOARD_QUERY_LIMIT)
    .openapi("ProfileLeaderboardQueryLimit", {
        example: 5,
        description: `The number of items to return.\n Must be [1, ${Config.LEADERBOARD_QUERY_LIMIT}], inclusive.`,
    });
export type ProfileLeaderboardEntry = z.infer<typeof ProfileLeaderboardEntrySchema>;

export const ProfileLeaderboardEntrySchema = AttendeeProfileSchema.pick({
    displayName: true,
    points: true,
    avatarUrl: true,
}).openapi("ProfileLeaderboardEntry");

export const ProfileLeaderboardEntriesSchema = z
    .object({ profiles: z.array(ProfileLeaderboardEntrySchema) })
    .openapi("ProfileLeaderboardEntries");

export const AttendeeProfileRankingSchema = z
    .object({
        ranking: z.number(),
    })
    .openapi("AttendeeProfileRanking", {
        example: {
            ranking: 1,
        },
    });

export const AttendeeProfileCreateRequestSchema = AttendeeProfileSchema.pick({
    discordTag: true,
    displayName: true,
    dietaryRestrictions: true,
    shirtSize: true,
})
    .extend({
        avatarId: z.string(),
    })
    .openapi("AttendeeProfileCreateRequest", {
        example: {
            displayName: "Bob The Great",
            discordTag: "hackillinois",
            avatarId: "goblin",
            dietaryRestrictions: ["Peanut Allergy"],
            shirtSize: "M",
        },
    });
export type AttendeeProfileCreateRequest = z.infer<typeof AttendeeProfileCreateRequestSchema>;

export const AttendeeProfileUpdateRequestSchema = AttendeeProfileCreateRequestSchema.partial().openapi(
    "AttendeeProfileUpdateRequest",
    {
        example: {
            displayName: "Bob The Great",
            discordTag: "hackillinois",
            avatarId: "goblin",
            shirtSize: "L",
        },
    },
);
export type AttendeeProfileUpdateRequest = z.infer<typeof AttendeeProfileUpdateRequestSchema>;

export const AttendeeProfileAddPointsRequestSchema = z
    .object({
        userId: UserIdSchema,
        points: z.number().openapi({ example: 10 }),
    })
    .openapi("AttendeeProfileAddPointsRequest");

export const [AttendeeProfileNotFoundError, AttendeeProfileNotFoundErrorSchema] = CreateErrorAndSchema({
    error: "NotFound",
    message: "Couldn't find the profile",
});

export const [AttendeeProfileAlreadyExistsError, AttendeeProfileAlreadyExistsErrorSchema] = CreateErrorAndSchema({
    error: "AlreadyExists",
    message: "Your profile is already created!",
});
