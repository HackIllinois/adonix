import { Router } from "express";
import { StatusCode } from "status-code-enum";
import { z } from "zod";
import Models from "../../common/models";
import { StaffShift } from "../staff/staff-schemas";
import { Role } from "../auth/auth-schemas";
import { getAuthenticatedUser } from "../../common/auth";
import {
    NotificationSendRequestSchema,
    NotificationSendSchema,
    NotificationMessagesSchema,
    RegisterDeviceTokenSchema,
} from "./notification-schemas";
import { sendNotification } from "./notification-service";
import specification, { Tag } from "../../middleware/specification";
import { SuccessResponseSchema } from "../../common/schemas";

const notificationsRouter = Router();

notificationsRouter.get(
    "/",
    specification({
        method: "get",
        path: "/notification/",
        tag: Tag.NOTIFICATION,
        role: Role.STAFF,
        summary: "Gets all notifications that have been sent",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "All the notifications",
                schema: NotificationMessagesSchema,
            },
        },
    }),
    async (_req, res) => {
        const notifications = (await Models.NotificationMessages.find()) || [];

        return res.status(StatusCode.SuccessOK).send(notifications);
    },
);

notificationsRouter.post(
    "/",
    specification({
        method: "post",
        path: "/notification/",
        tag: Tag.NOTIFICATION,
        role: Role.USER,
        summary: "Registers a device token to be associate with the currently authenticated user",
        body: RegisterDeviceTokenSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Successfully registered",
                schema: SuccessResponseSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);
        const { deviceToken } = req.body;

        await Models.NotificationMappings.updateOne({ userId: userId }, { deviceToken: deviceToken }, { upsert: true });
        return res.status(StatusCode.SuccessOK).send({ success: true });
    },
);

notificationsRouter.post(
    "/send/",
    specification({
        method: "post",
        path: "/notification/send/",
        tag: Tag.NOTIFICATION,
        role: Role.ADMIN,
        summary: "Sends a notification to a specified group of users",
        description:
            "Can filter by: \n" +
            "- `eventId`: users following a event\n" +
            "- `role`: users that have a role\n" +
            "- `staffShift`: staff in a staff shift\n" +
            "- `foodWave`: users in a food wave \n" +
            "- `userIds`: some set of users\n" +
            "Filters are intersecting, so `eventId = 123` and `foodWave = 1` would get users following event 123 AND in food wave 1.",
        body: NotificationSendRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The result of the sent batch",
                schema: NotificationSendSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);

        const sendRequest = req.body;

        const usersForEachFilter: string[][] = [];

        if (sendRequest.eventId) {
            const eventFollowers = await Models.EventFollowers.findOne({ eventId: sendRequest.eventId });
            usersForEachFilter.push(eventFollowers?.followers ?? []);
        }

        if (sendRequest.role) {
            const roles = await Models.AuthInfo.find({ roles: { $in: [sendRequest.role] } }, "userId");
            usersForEachFilter.push(roles.map((x) => x.userId));
        }

        if (sendRequest.staffShift) {
            const staffShifts: StaffShift[] = await Models.StaffShift.find({ shifts: { $in: [sendRequest.staffShift] } });
            usersForEachFilter.push(staffShifts.map((x) => x.userId));
        }

        if (sendRequest.foodWave) {
            const foodwaves = await Models.AttendeeProfile.find({ foodWave: sendRequest.foodWave });
            usersForEachFilter.push(foodwaves.map((x) => x.userId));
        }

        if (sendRequest.userIds) {
            usersForEachFilter.push(sendRequest.userIds);
        }

        // Get users which match every filter
        const targetUserIds = usersForEachFilter.reduce((acc, array) => acc.filter((element) => array.includes(element)));

        const startTime = new Date();

        const sent: string[] = [];
        const failed: string[] = [];

        const notificationMappings = await Models.NotificationMappings.find({ userId: { $in: targetUserIds } }).exec();
        const messages = notificationMappings
            .filter((x) => x?.deviceToken != undefined)
            .map((mapping) =>
                sendNotification({
                    token: mapping.deviceToken,
                    title: sendRequest.title,
                    body: sendRequest.body,
                })
                    .then((ticket) => {
                        // Check if the ticket indicates success
                        if (ticket.status === "ok") {
                            sent.push(mapping.userId);
                        } else if (ticket.status === "error") {
                            console.log(`Error sending to ${mapping.userId}:`, ticket.message);
                            failed.push(mapping.userId);
                        }
                    })
                    .catch((e) => {
                        console.log(e);
                        failed.push(mapping.userId);
                    }),
            );
        await Promise.allSettled(messages);

        await Models.NotificationMessages.create({
            sender: userId,
            title: sendRequest.title,
            body: sendRequest.body,
            sent,
            failed,
        });

        const endTime = new Date();
        const timeElapsed = endTime.getTime() - startTime.getTime();
        return res.status(StatusCode.SuccessOK).send({ sent, failed, time_ms: timeElapsed });
    },
);

notificationsRouter.post(
    "/send-test/",
    specification({
        method: "post",
        path: "/notification/send-test/",
        tag: Tag.NOTIFICATION,
        role: Role.STAFF,
        summary: "Sends a test notification to the currently authenticated user",
        description: "Useful for testing if your device token is registered correctly and notifications are working.",
        body: z.object({
            title: z.string(),
            body: z.string(),
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The result of the test notification",
                schema: z.object({
                    success: z.boolean(),
                    userId: z.string(),
                    message: z.string(),
                }),
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "No device token registered for this user",
                schema: z.object({
                    success: z.boolean(),
                    message: z.string(),
                }),
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);
        const { title, body } = req.body;

        const mapping = await Models.NotificationMappings.findOne({ userId });

        if (!mapping || !mapping.deviceToken) {
            return res.status(StatusCode.ClientErrorNotFound).send({
                success: false,
                message: "No device token registered for this user. Register a token first using POST /notification/",
            });
        }

        try {
            const ticket = await sendNotification({
                token: mapping.deviceToken,
                title,
                body,
            });

            if (ticket.status === "ok") {
                return res.status(StatusCode.SuccessOK).send({
                    success: true,
                    userId,
                    message: "Test notification sent successfully!",
                });
            } else {
                return res.status(StatusCode.SuccessOK).send({
                    success: false,
                    userId,
                    message: `Failed to send: ${ticket.message || "Unknown error"}`,
                });
            }
        } catch (error) {
            return res.status(StatusCode.SuccessOK).send({
                success: false,
                userId,
                message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
            });
        }
    },
);

export default notificationsRouter;
