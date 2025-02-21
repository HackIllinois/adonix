import { Router } from "express";
import { StatusCode } from "status-code-enum";
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

        const messageTemplate = {
            notification: {
                title: sendRequest.title,
                body: sendRequest.body,
            },
        };
        const startTime = new Date();

        const sent: string[] = [];
        const failed: string[] = [];

        const notificationMappings = await Models.NotificationMappings.find({ userId: { $in: targetUserIds } }).exec();
        const messages = notificationMappings
            .filter((x) => x?.deviceToken != undefined)
            .map((mapping) =>
                sendNotification({ token: mapping.deviceToken, ...messageTemplate })
                    .then(() => {
                        sent.push(mapping.userId);
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

export default notificationsRouter;
