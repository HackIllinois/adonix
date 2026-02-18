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
    AttendeeProfileNextRankSchema,
    RafflePointsSchema,
} from "./profile-schemas";
import Models from "../../common/models";
import { StatusCode } from "status-code-enum";
import { getAuthenticatedUser } from "../../common/auth";
import { Role } from "../auth/auth-schemas";
import specification, { Tag } from "../../middleware/specification";
import { z } from "zod";
import { UserIdSchema } from "../../common/schemas";
import { getAvatarUrlForId } from "./profile-lib";

const profileRouter = Router();

profileRouter.get(
    "/raffle-points/",
    specification({
        method: "get",
        path: "/profile/raffle-points/",
        tag: Tag.PROFILE,
        role: Role.ATTENDEE,
        summary: "Gets the raffle points for the currently authenticated user",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The raffle points",
                schema: RafflePointsSchema,
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

        return res.status(StatusCode.SuccessOK).send({ rafflePoints: profile.rafflePoints });
    },
);

profileRouter.get(
    "/raffle-points/:id/",
    specification({
        method: "get",
        path: "/profile/raffle-points/{id}/",
        tag: Tag.PROFILE,
        role: Role.STAFF,
        summary: "Gets raffle points for the specified user",
        parameters: z.object({
            id: UserIdSchema,
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The raffle points",
                schema: RafflePointsSchema,
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

        return res.status(StatusCode.SuccessOK).send({ rafflePoints: profile.rafflePoints });
    },
);

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

        const currentUser = await Models.AttendeeProfile.findOne({ userId });

        if (!currentUser) {
            return res.status(StatusCode.ClientErrorNotFound).send(AttendeeProfileNotFoundError);
        }

        const peopleAbove = await Models.AttendeeProfile.count({ pointsAccumulated: { $gt: currentUser.pointsAccumulated } });

        const ranking = peopleAbove + Config.RANKING_OFFSET;
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
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);
        const { avatarId, discordTag, displayName, dietaryRestrictions, shirtSize } = req.body;

        const existingProfile = await Models.AttendeeProfile.findOne({ userId });
        if (existingProfile) {
            return res.status(StatusCode.ClientErrorBadRequest).send(AttendeeProfileAlreadyExistsError);
        }

        const profile: AttendeeProfile = {
            userId,
            discordTag,
            displayName,
            avatarUrl: getAvatarUrlForId(avatarId),
            points: Config.DEFAULT_POINT_VALUE,
            pointsAccumulated: Config.DEFAULT_POINT_VALUE,
            rafflePoints: 0,
            foodWave: dietaryRestrictions.filter((res) => res.toLowerCase() != "none").length > 0 ? 1 : 2,
            dietaryRestrictions,
            shirtSize,
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
        const { avatarId, discordTag, displayName, shirtSize } = req.body;

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
                shirtSize,
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

profileRouter.get(
    "/ranking/place/",
    specification({
        method: "get",
        path: "/profile/ranking/place/",
        tag: Tag.PROFILE,
        role: Role.ATTENDEE,
        summary: "Gets how many points away from the next rank for current authenticated user",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The number of points",
                schema: AttendeeProfileNextRankSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Couldn't find the profile (is it created yet?)",
                schema: AttendeeProfileNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);

        const currentUser = await Models.AttendeeProfile.findOne({ userId });

        if (!currentUser) {
            return res.status(StatusCode.ClientErrorNotFound).send(AttendeeProfileNotFoundError);
        }

        const aboveUser = await Models.AttendeeProfile.findOne({
            pointsAccumulated: { $gt: currentUser.pointsAccumulated },
        }).sort({
            pointsAccumulated: 1,
        });

        if (!aboveUser) {
            return res.status(StatusCode.SuccessOK).send({ points: 0, first: true });
        }

        const pointDiff = aboveUser.pointsAccumulated - currentUser.pointsAccumulated;
        return res.status(StatusCode.SuccessOK).send({ points: pointDiff, first: false });
    },
);

export default profileRouter;
