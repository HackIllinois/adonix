import { Router } from "express";
import { StatusCode } from "status-code-enum";

import { Role } from "../auth/auth-schemas";
import { generateJwtToken, getAuthenticatedUser, getJwtPayloadFromDB } from "../../common/auth";
import { performCheckIn, PerformCheckInErrors } from "../staff/staff-lib";

import {
    QRInfoSchema,
    UserIdSchema,
    UserInfo,
    UserNotFoundError,
    UserNotFoundErrorSchema,
    UserInfoSchema,
    EventsFollowingSchema,
    EventNotFoundErrorSchema,
    EventNotFoundError,
    ScanEventRequestSchema,
    ScanEventSchema,
} from "./user-schemas";
import Models from "../../database/models";
import Config from "../../common/config";
import specification, { Tag } from "../../middleware/specification";
import { z } from "zod";

const userRouter = Router();

userRouter.get(
    "/qr/",
    specification({
        method: "get",
        path: "/user/qr/",
        tag: Tag.USER,
        role: Role.USER,
        summary: "Gets a QR code for the currently authenticated user",
        description: "You should fetch this QR code every 15 seconds, as it expires every 20 seconds.",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The currently authenticated user's QR code",
                schema: QRInfoSchema,
            },
        },
    }),
    (req, res) => {
        const payload = getAuthenticatedUser(req);
        const token = generateJwtToken(payload, false, Config.QR_EXPIRY_TIME);
        const uri = `hackillinois://user?userToken=${token}`;
        return res.status(StatusCode.SuccessOK).send({ userId: payload.id, qrInfo: uri });
    },
);

userRouter.get(
    "/qr/:id",
    specification({
        method: "get",
        path: "/user/qr/{id}/",
        tag: Tag.USER,
        role: Role.STAFF,
        summary: "Gets a QR code for the specified user",
        description:
            "This is staff-only since you can get ANY user's QR code with this endpoint.\n" +
            "If you want to get the currently authenticated user's QR code, use `GET /user/qr`.",
        parameters: z.object({
            id: UserIdSchema,
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The specified user's QR code",
                schema: QRInfoSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Could not find the user specified",
                schema: UserNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const userId = req.params.id;
        const payload = await getJwtPayloadFromDB(userId);

        // Return not found if we haven't created a payload yet
        if (!payload) {
            return res.status(StatusCode.ClientErrorNotFound).json(UserNotFoundError);
        }

        // Generate the uri
        const token: string = generateJwtToken(payload, false, Config.QR_EXPIRY_TIME);
        const uri = `hackillinois://user?userToken=${token}`;
        return res.status(StatusCode.SuccessOK).send({ userId: payload.id, qrInfo: uri });
    },
);

userRouter.get(
    "/",
    specification({
        method: "get",
        path: "/user/",
        tag: Tag.USER,
        role: Role.USER,
        summary: "Gets the user info for the currently authenticated user",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The currently authenticated user's user info",
                schema: UserInfoSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Could not find the user info",
                schema: UserNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);
        const user = await Models.UserInfo.findOne({ userId });

        if (user) {
            return res.status(StatusCode.SuccessOK).json(user);
        }

        return res.status(StatusCode.ClientErrorNotFound).json(UserNotFoundError);
    },
);

userRouter.get(
    "/following/",
    specification({
        method: "get",
        path: "/user/following/",
        tag: Tag.USER,
        role: Role.USER,
        summary: "Gets the events the currently authenticated user is following",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The followed events",
                schema: EventsFollowingSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);

        const following = await Models.AttendeeFollowing.findOne({ userId });
        return res.status(StatusCode.SuccessOK).send({ userId, following: following?.following || [] });
    },
);

userRouter.put(
    "/follow/:id/",
    specification({
        method: "put",
        path: "/user/follow/{id}/",
        tag: Tag.USER,
        role: Role.USER,
        summary: "Follows the specified event",
        parameters: z.object({
            id: UserIdSchema,
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Events followed after successfully following",
                schema: EventsFollowingSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Could not find the event to follow",
                schema: EventNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);
        const { id: eventId } = req.params;

        const eventExists = await Models.Event.findOne({ eventId });

        if (!eventExists) {
            return res.status(StatusCode.ClientErrorNotFound).json(EventNotFoundError);
        }

        await Models.EventFollowers.findOneAndUpdate(
            { eventId },
            { $addToSet: { followers: userId } },
            { new: true, upsert: true },
        );

        const { following } = await Models.AttendeeFollowing.findOneAndUpdate(
            { userId },
            { $addToSet: { following: eventId } },
            { new: true, upsert: true },
        );

        return res.status(StatusCode.SuccessOK).send({ userId, following });
    },
);

userRouter.delete(
    "/unfollow/:id/",
    specification({
        method: "delete",
        path: "/user/unfollow/{id}/",
        tag: Tag.USER,
        role: Role.USER,
        summary: "Unfollows the specified event",
        parameters: z.object({
            id: UserIdSchema,
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Events followed after successfully unfollowing",
                schema: EventsFollowingSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Could not find the event to unfollow",
                schema: EventNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);
        const { id: eventId } = req.params;

        const eventExists = await Models.Event.findOne({ eventId });

        if (!eventExists) {
            return res.status(StatusCode.ClientErrorNotFound).json(EventNotFoundError);
        }

        await Models.EventFollowers.findOneAndUpdate({ eventId: eventId }, { $pull: { followers: userId } }, { new: true });

        const attendeeFollowing = await Models.AttendeeFollowing.findOneAndUpdate(
            { userId },
            { $pull: { following: eventId } },
            { new: true },
        );

        return res.status(StatusCode.SuccessOK).send({ userId, following: attendeeFollowing?.following || [] });
    },
);

userRouter.get(
    "/:id/",
    specification({
        method: "get",
        path: "/user/{id}/",
        tag: Tag.USER,
        role: Role.STAFF,
        summary: "Gets the user info for the specified user",
        description:
            "This is staff-only since you can get ANY user's info with this endpoint.\n" +
            "To get the currently authenticated user, use `GET /user/`",
        parameters: z.object({
            id: UserIdSchema,
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The specified's user info",
                schema: UserInfoSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Could not find the user info",
                schema: UserNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = req.params;
        const userInfo: UserInfo | null = await Models.UserInfo.findOne({ userId });
        if (userInfo) {
            return res.status(StatusCode.SuccessOK).send(userInfo);
        } else {
            return res.status(StatusCode.ClientErrorNotFound).send(UserNotFoundError);
        }
    },
);

userRouter.put(
    "/scan-event/",
    specification({
        method: "put",
        path: "/user/scan-event/",
        tag: Tag.USER,
        role: Role.USER,
        summary: "Checks in the currently authenticated user and marks their attendance",
        body: ScanEventRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Successfully checked in",
                schema: ScanEventSchema,
            },
            ...PerformCheckInErrors,
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);
        const eventId = req.body.eventId;

        const result = await performCheckIn(eventId, userId);

        if (!result.success) {
            return res.status(result.status).json(result.error);
        }

        return res.status(StatusCode.SuccessOK).json({ success: true, points: result.points });
    },
);

export default userRouter;
