import { NextFunction, Request, Response, Router } from "express";
import { strongJwtVerification } from "../../middleware/verify-jwt.js";
import { RouterError } from "../../middleware/error-handler.js";
import { StatusCode } from "status-code-enum";
import Models from "../../database/models.js";
import { JwtPayload } from "../auth/auth-models.js";
import { hasStaffPerms } from "../auth/auth-lib.js";
import { NotificationSendFormat, isValidNotificationSendFormat } from "./notification-formats.js";
import { StaffShift } from "database/staff-db.js";
import { NotificationsMiddleware } from "../../middleware/fcm.js";
import Config from "../../config.js";
import axios from "axios";

const notificationsRouter: Router = Router();

notificationsRouter.get("/", strongJwtVerification, async (_: Request, res: Response, next: NextFunction) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    if (!hasStaffPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "Forbidden"));
    }

    const notifs = await Models.NotificationMessages.find();

    return res.status(StatusCode.SuccessOK).send(notifs ?? []);
});

// register your current device token as associated with your userId
notificationsRouter.post("/", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    const deviceToken: string | undefined = req.body.deviceToken;
    const userId: string = payload.id;

    if (!deviceToken) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "NoDeviceToken"));
    }

    await Models.NotificationMappings.updateOne({ userId: userId }, { deviceToken: deviceToken }, { upsert: true });
    return res.status(StatusCode.SuccessOK).send({ status: "Success" });
});

// Internal public route used to batch send. Sends notifications to specified users.
// Only accepts Config.NOTIFICATION_BATCH_SIZE users.
notificationsRouter.post(
    "/send/batch",
    strongJwtVerification,
    NotificationsMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
        const payload: JwtPayload = res.locals.payload as JwtPayload;
        const admin = res.locals.fcm;
        const sendRequest = req.body as { title: string; body: string; userIds: string[] };
        const targetUserIds = sendRequest.userIds;
        if (!targetUserIds || !sendRequest.body || !sendRequest.title) {
            return next(new RouterError(StatusCode.ClientErrorBadRequest, "InvalidFormat"));
        }
        if (targetUserIds.length > Config.NOTIFICATION_BATCH_SIZE) {
            return next(new RouterError(StatusCode.ClientErrorBadRequest, "TooManyUsers"));
        }
        const messageTemplate = {
            notification: {
                title: sendRequest.title,
                body: sendRequest.body,
            },
        };
        const startTime = new Date();
        const notifMappings = await Models.NotificationMappings.find({ userId: { $in: targetUserIds } }).exec();
        const deviceTokens = notifMappings.map((x) => x?.deviceToken).filter((x): x is string => x != undefined);
        let errors = 0;
        const messages = deviceTokens.map((token) =>
            admin
                .messaging()
                .send({ token: token, ...messageTemplate })
                .catch(() => {
                    errors++;
                }),
        );
        await Promise.all(messages);
        await Models.NotificationMessages.create({
            sender: payload.id,
            title: sendRequest.title,
            body: sendRequest.body,
            recipientCount: targetUserIds.length,
        });
        const endTime = new Date();
        const timeElapsed = endTime.getTime() - startTime.getTime();
        return res
            .status(StatusCode.SuccessOK)
            .send({ status: "Success", recipients: targetUserIds.length, errors: errors, time_ms: timeElapsed });
    },
);

// ADMIN ONLY ENDPOINT
// Send a notification to a set of people
notificationsRouter.post("/send/", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const startTime = new Date();
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    if (!hasStaffPerms(payload)) {
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

    let recipients = 0;
    let errors = 0;
    const requests = [];

    for (let i = 0; i < targetUserIds.length; i += Config.NOTIFICATION_BATCH_SIZE) {
        const thisUserIds = targetUserIds.slice(i, i + Config.NOTIFICATION_BATCH_SIZE);
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const reqUrl = `${baseUrl}/notification/send/batch`;
        const data = {
            title: sendRequest.title,
            body: sendRequest.body,
            userIds: thisUserIds,
        };
        const config = {
            headers: {
                "content-type": req.headers["content-type"],
                "user-agent": req.headers["user-agent"],
                authorization: req.headers.authorization,
            },
        };
        const request = axios.post(reqUrl, data, config).then((res) => {
            recipients += res.data.recipients;
            errors += res.data.errors;
        });
        requests.push(request);
    }

    await Promise.all(requests);

    const endTime = new Date();
    const timeElapsed = endTime.getTime() - startTime.getTime();

    return res
        .status(StatusCode.SuccessOK)
        .send({ status: "Success", recipients: recipients, errors: errors, time_ms: timeElapsed });
});

export default notificationsRouter;
