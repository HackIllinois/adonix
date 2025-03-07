import cors from "cors";
import { Router } from "express";
import Config from "../../common/config";
import {
    AttendeeProfile,
    AttendeeProfileAlreadyExistsError,
    AttendeeProfileAlreadyExistsErrorSchema,
    AttendeeProfileCreateRequestSchema,
    AttendeeProfileNotFoundError,
    AttendeeProfileNotFoundErrorSchema,
    AttendeeProfileRankingSchema,
    AttendeeProfileSchema,
    AttendeeProfileUpdateRequestSchema,
    ProfileLeaderboardEntriesSchema,
    ProfileLeaderboardEntry,
    ProfileLeaderboardQueryLimitSchema,
} from "./profile-schemas";
import { RegistrationNotFoundError, RegistrationNotFoundErrorSchema } from "../registration/registration-schemas";
import Models from "../../common/models";
import { StatusCode } from "status-code-enum";
import { getAuthenticatedUser } from "../../common/auth";
import { Role } from "../auth/auth-schemas";
import specification, { Tag } from "../../middleware/specification";
import { z } from "zod";
import { UserIdSchema } from "../../common/schemas";
import { getAvatarUrlForId } from "./profile-lib";

const profileRouter = Router();

profileRouter.use(cors({ origin: "*" }));

profileRouter.get(
    "/leaderboard/",
    specification({
        method: "get",
        path: "/profile/leaderboard/",
        tag: Tag.PROFILE,
        role: null,
        summary: "Gets the profile leaderboard",
        description: `This endpoint is limited - you must provide a limit in the range \`[1, ${Config.LEADERBOARD_QUERY_LIMIT}]\`, inclusive.`,
        query: z.object({
            limit: ProfileLeaderboardQueryLimitSchema.optional(),
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The leaderboard",
                schema: ProfileLeaderboardEntriesSchema,
            },
        },
    }),
    async (req, res) => {
        const { limit = Config.LEADERBOARD_QUERY_LIMIT } = req.query;

        // We use points that are accumulated over all time (not current points) to get leaderboard
        const leaderboardProfiles = await Models.AttendeeProfile.find().sort({ pointsAccumulated: -1 }).limit(limit);
        const filteredLeaderboardEntries: ProfileLeaderboardEntry[] = leaderboardProfiles.map((profile) => ({
            displayName: profile.displayName,
            points: profile.pointsAccumulated,
            avatarUrl: profile.avatarUrl,
        }));

        return res.status(StatusCode.SuccessOK).send({
            profiles: filteredLeaderboardEntries,
        });
    },
);

profileRouter.get(
    "/",
    specification({
        method: "get",
        path: "/profile/",
        tag: Tag.PROFILE,
        role: Role.ATTENDEE,
        summary: "Gets the currently authenticated user's profile",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The profile",
                schema: AttendeeProfileSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Couldn't find the profile (is it created yet?)",
                schema: AttendeeProfileNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);

        const profile = await Models.AttendeeProfile.findOne({ userId: userId });

        if (!profile) {
            return res.status(StatusCode.ClientErrorNotFound).send(AttendeeProfileNotFoundError);
        }

        return res.status(StatusCode.SuccessOK).send(profile);
    },
);

profileRouter.get(
    "/ranking/",
    specification({
        method: "get",
        path: "/profile/ranking/",
        tag: Tag.PROFILE,
        role: Role.ATTENDEE,
        summary: "Gets the ranking of the currently authenticated user",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The ranking",
                schema: AttendeeProfileRankingSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Couldn't find the profile (is it created yet?)",
                schema: AttendeeProfileNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);

        const sortedUsers = await Models.AttendeeProfile.find().sort({ pointsAccumulated: -1, userId: 1 });
        const userIndex = sortedUsers.findIndex((u) => u.userId == userId);

        if (userIndex < 0) {
            return res.status(StatusCode.ClientErrorNotFound).send(AttendeeProfileNotFoundError);
        }

        const ranking = userIndex + Config.RANKING_OFFSET;
        return res.status(StatusCode.SuccessOK).send({ ranking: ranking });
    },
);

profileRouter.get(
    "/:id/",
    specification({
        method: "get",
        path: "/profile/{id}/",
        tag: Tag.PROFILE,
        role: Role.STAFF,
        summary: "Gets the specified user's profile",
        parameters: z.object({
            id: UserIdSchema,
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The profile",
                schema: AttendeeProfileSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Couldn't find the profile",
                schema: AttendeeProfileNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = req.params;

        const profile = await Models.AttendeeProfile.findOne({ userId });
        if (!profile) {
            return res.status(StatusCode.ClientErrorNotFound).send(AttendeeProfileNotFoundError);
        }

        return res.status(StatusCode.SuccessOK).send(profile);
    },
);

profileRouter.post(
    "/",
    specification({
        method: "post",
        path: "/profile/",
        tag: Tag.PROFILE,
        role: Role.ATTENDEE,
        summary: "Creates profile of the currently authenticated user",
        body: AttendeeProfileCreateRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The created profile",
                schema: AttendeeProfileSchema,
            },
            [StatusCode.ClientErrorBadRequest]: {
                description: "Profile already created",
                schema: AttendeeProfileAlreadyExistsErrorSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Couldn't find registration information",
                schema: RegistrationNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);
        const { avatarId, discordTag, displayName } = req.body;

        const registrationApplication = await Models.RegistrationApplication.findOne({
            userId,
        });
        if (!registrationApplication) {
            return res.status(StatusCode.ClientErrorNotFound).send(RegistrationNotFoundError);
        }

        const existingProfile = await Models.AttendeeProfile.findOne({ userId });
        if (existingProfile) {
            return res.status(StatusCode.ClientErrorBadRequest).send(AttendeeProfileAlreadyExistsError);
        }

        const dietaryRestrictions = registrationApplication.dietaryRestrictions;
        const profile: AttendeeProfile = {
            userId,
            discordTag,
            displayName,
            avatarUrl: getAvatarUrlForId(avatarId),
            points: Config.DEFAULT_POINT_VALUE,
            pointsAccumulated: Config.DEFAULT_POINT_VALUE,
            foodWave: dietaryRestrictions.filter((res) => res.toLowerCase() != "none").length > 0 ? 1 : 2,
        };

        const newProfile = await Models.AttendeeProfile.create(profile);
        return res.status(StatusCode.SuccessOK).send(newProfile);
    },
);

profileRouter.put(
    "/",
    specification({
        method: "put",
        path: "/profile/",
        tag: Tag.PROFILE,
        role: Role.ATTENDEE,
        summary: "Updates profile of the currently authenticated user",
        body: AttendeeProfileUpdateRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The ranking",
                schema: AttendeeProfileSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Couldn't find ",
                schema: AttendeeProfileNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);
        const { avatarId, discordTag, displayName } = req.body;

        const existingProfile = await Models.AttendeeProfile.findOne({ userId });
        if (!existingProfile) {
            return res.status(StatusCode.ClientErrorNotFound).send(AttendeeProfileNotFoundError);
        }

        const newProfile = await Models.AttendeeProfile.findOneAndUpdate(
            {
                userId,
            },
            {
                displayName,
                avatarUrl: avatarId ? getAvatarUrlForId(avatarId) : undefined,
                discordTag,
            },
            {
                new: true,
            },
        );

        if (!newProfile) {
            throw new Error("Failed to update profile");
        }

        return res.status(StatusCode.SuccessOK).send(newProfile);
    },
);

export default profileRouter;
