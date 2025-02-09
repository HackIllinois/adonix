import { prop } from "@typegoose/typegoose";
import { z } from "zod";
import Config from "../../common/config";
import { CreateErrorAndSchema, UserIdSchema } from "../../common/schemas";

export class AttendeeProfile {
    @prop({ required: true })
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
}

export const ProfileLeaderboardQueryLimitSchema = z.coerce
    .number()
    .min(1)
    .max(Config.LEADERBOARD_QUERY_LIMIT)
    .openapi("ProfileLeaderboardQueryLimit", {
        example: 5,
        description: `The number of items to return.\n Must be [1, ${Config.LEADERBOARD_QUERY_LIMIT}], inclusive.`,
    });
export type ProfileLeaderboardEntry = z.infer<typeof ProfileLeaderboardEntrySchema>;

export const ProfileLeaderboardEntrySchema = z
    .object({
        points: z.number(),
        displayName: z.string().openapi({ example: "Cool Guys" }),
    })
    .openapi("ProfileLeaderboardEntry");

export const ProfileLeaderboardEntriesSchema = z
    .object({ profiles: z.array(ProfileLeaderboardEntrySchema) })
    .openapi("ProfileLeaderboardEntries");

export const AttendeeProfileSchema = z
    .object({
        userId: UserIdSchema,
        displayName: z.string(),
        avatarUrl: z.string(),
        discordTag: z.string(),
        points: z.number(),
        pointsAccumulated: z.number(),
        foodWave: z.number(),
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
        },
    });

export const AttendeeProfileRankingSchema = z
    .object({
        ranking: z.number(),
    })
    .openapi("AttendeeProfileRanking", {
        example: {
            ranking: 1,
        },
    });

export const AvatarSchema = z.string().openapi("Avatar");

export const AttendeeProfileCreateRequestSchema = AttendeeProfileSchema.pick({ discordTag: true, displayName: true })
    .extend({
        avatarId: AvatarSchema,
    })
    .openapi("AttendeeProfileCreateRequest", {
        example: {
            displayName: "Bob The Great",
            discordTag: "hackillinois",
            avatarId: "goblin",
        },
    });
export type AttendeeProfileCreateRequest = z.infer<typeof AttendeeProfileCreateRequestSchema>;

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
