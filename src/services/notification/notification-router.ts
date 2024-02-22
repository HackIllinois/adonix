import { NextFunction, Request, Response, Router } from "express";
import { strongJwtVerification } from "../../middleware/verify-jwt.js";
import { RouterError } from "../../middleware/error-handler.js";
import { StatusCode } from "status-code-enum";
import Models from "../../database/models.js";
import { JwtPayload } from "../auth/auth-models.js";
import { hasAdminPerms, hasStaffPerms } from "../auth/auth-lib.js";
import { NotificationSendFormat, isValidNotificationSendFormat } from "./notification-formats.js";
import { StaffShift } from "database/staff-db.js";
import { NotificationsMiddleware } from "../../middleware/fcm.js";

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

// ADMIN ONLY ENDPOINT
// Send a notification to a set of people
notificationsRouter.post(
    "/send/",
    strongJwtVerification,
    NotificationsMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
        const startTime = new Date();
        const admin = res.locals.fcm;
        const payload: JwtPayload = res.locals.payload as JwtPayload;

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

        const messageTemplate = {
            notification: {
                title: sendRequest.title,
                body: sendRequest.body,
            },
        };

        const notifMappings = await Models.NotificationMappings.find({ userId: { $in: targetUserIds } }).exec();
        const deviceTokens = notifMappings.map((x) => x?.deviceToken).filter((x): x is string => x != undefined);

        const messages = deviceTokens.map((token) => admin.messaging().send({ token: token, ...messageTemplate }));

        let error_ct = 0;
        try {
            await Promise.all(messages);
        } catch (e) {
            error_ct += 1; // eslint-disable-line no-magic-numbers
        }

        await Models.NotificationMessages.create({
            sender: payload.id,
            title: sendRequest.title,
            body: sendRequest.body,
            recipientCount: targetUserIds.length,
        });

        const endTime = new Date();
        const timeElapsed = endTime.getTime() - startTime.getTime();
        console.log("SENT A NOTIFICATION", targetUserIds.length, timeElapsed, error_ct);

        return res.status(StatusCode.SuccessOK).send({ status: "Success", errors: error_ct });
    },
);

export default notificationsRouter;
