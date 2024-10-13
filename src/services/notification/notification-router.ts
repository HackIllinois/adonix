import { NextFunction, Request, Response, Router } from "express";
import { strongJwtVerification } from "../../middleware/verify-jwt";
import { RouterError } from "../../middleware/error-handler";
import { StatusCode } from "status-code-enum";
import Models from "../../database/models";
import { StaffShift } from "../staff/staff-schemas";
import { JwtPayload } from "../auth/auth-models";
import { hasAdminPerms, hasStaffPerms } from "../../common/auth";
import { NotificationSendFormat, isValidNotificationSendFormat } from "./notification-formats";
import Config from "../../common/config";
import { sendNotification } from "./notification-service";

const notificationsRouter = Router();

notificationsRouter.get("/", strongJwtVerification, async (_: Request, res: Response, next: NextFunction) => {
    const payload = res.locals.payload as JwtPayload;

    if (!hasStaffPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "Forbidden"));
    }

    const notifs = await Models.NotificationMessages.find();

    return res.status(StatusCode.SuccessOK).send(notifs ?? []);
});

// register your current device token as associated with your userId
notificationsRouter.post("/", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const payload = res.locals.payload as JwtPayload;

    const deviceToken: string | undefined = req.body.deviceToken;
    const userId = payload.id;

    if (!deviceToken) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "NoDeviceToken"));
    }

    await Models.NotificationMappings.updateOne({ userId: userId }, { deviceToken: deviceToken }, { upsert: true });
    return res.status(StatusCode.SuccessOK).send({ status: "Success" });
});

// ADMIN ONLY ENDPOINT
// Gets batches that can be used to send notifications
// Call this first, then call /send for each batchId you get
notificationsRouter.post("/batch/", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const payload = res.locals.payload as JwtPayload;

    if (!hasAdminPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "Forbidden"));
    }

    const sendRequest = req.body as NotificationSendFormat;
    sendRequest.role = sendRequest.role?.toUpperCase();

    if (!isValidNotificationSendFormat(sendRequest)) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "BadSendRequest"));
    }

    let targetUserIds: string[] = [];

    if (sendRequest.eventId) {
        const eventFollowers = await Models.EventFollowers.findOne({ eventId: sendRequest.eventId });
        const eventUserIds = eventFollowers?.followers ?? [];
        targetUserIds = targetUserIds.concat(eventUserIds);
    }

    if (sendRequest.role) {
        const roles = await Models.AuthInfo.find({ roles: { $in: [sendRequest.role] } }, "userId");
        const roleUserIds = roles.map((x) => x.userId);
        targetUserIds = targetUserIds.concat(roleUserIds);
    }

    if (sendRequest.staffShift) {
        const staffShifts: StaffShift[] = await Models.StaffShift.find({ shifts: { $in: [sendRequest.staffShift] } });
        const staffUserIds: string[] = staffShifts.map((x) => x.userId);
        targetUserIds = targetUserIds.concat(staffUserIds);
    }

    if (sendRequest.foodWave) {
        const foodwaves = await Models.AttendeeProfile.find({ foodWave: sendRequest.foodWave });
        const foodUserIds = foodwaves.map((x) => x.userId);
        targetUserIds = targetUserIds.concat(foodUserIds);
    }

    const message = await Models.NotificationMessages.create({
        sender: payload.id,
        title: sendRequest.title,
        body: sendRequest.body,
        batches: [],
    });

    const batchIds: string[] = [];

    for (let i = 0; i < targetUserIds.length; i += Config.NOTIFICATION_BATCH_SIZE) {
        const thisUserIds = targetUserIds.slice(i, i + Config.NOTIFICATION_BATCH_SIZE);
        const batchId = JSON.stringify([message.id, thisUserIds]);
        batchIds.push(Buffer.from(batchId).toString("base64url"));
    }

    return res.status(StatusCode.SuccessOK).send({ status: "Success", batches: batchIds });
});

// Sends notifications to a batch of users, gotten from /notification/batch
// Only accepts Config.NOTIFICATION_BATCH_SIZE users.
notificationsRouter.post("/send", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const payload = res.locals.payload as JwtPayload;
    const sendRequest = req.body as { batchId: string };

    if (!hasAdminPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "Forbidden"));
    }
    if (!sendRequest.batchId) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "NoBatchId"));
    }

    const decodedBatchId = Buffer.from(sendRequest.batchId, "base64url").toString("utf-8");
    const [messageId, targetUserIds] = JSON.parse(decodedBatchId) as [string, string[]];

    const message = await Models.NotificationMessages.findById(messageId);

    if (!message || !targetUserIds || targetUserIds.length > Config.NOTIFICATION_BATCH_SIZE) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "InvalidBatch"));
    }
    const messageTemplate = {
        notification: {
            title: message.title,
            body: message.body,
        },
    };
    const startTime = new Date();
    let notifMappings = await Models.NotificationMappings.find({ userId: { $in: targetUserIds } }).exec();
    notifMappings = notifMappings.filter((x) => x?.deviceToken != undefined);

    const sent: string[] = [];
    const failed: string[] = [];

    const messages = notifMappings.map((mapping) =>
        sendNotification({ token: mapping.deviceToken, ...messageTemplate })
            .then(() => {
                sent.push(mapping.userId);
            })
            .catch(() => {
                failed.push(mapping.userId);
            }),
    );
    await Promise.all(messages);
    await Models.NotificationMessages.findOneAndUpdate(
        {
            _id: messageId,
        },
        {
            $push: {
                batches: {
                    sent,
                    failed,
                },
            },
        },
    );
    const endTime = new Date();
    const timeElapsed = endTime.getTime() - startTime.getTime();
    return res.status(StatusCode.SuccessOK).send({ status: "Success", sent, failed, time_ms: timeElapsed });
});

export default notificationsRouter;
