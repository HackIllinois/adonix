import { Router } from "express";

import { strongJwtVerification } from "../../middleware/verify-jwt.js";
import { hasAdminPerms, hasStaffPerms } from "../auth/auth-lib.js";

import { AttendanceFormat, isValidStaffShiftFormat } from "./staff-formats.js";
import Config from "../../config.js";

import Models from "../../database/models.js";
import { StatusCode } from "status-code-enum";
import { RouterError } from "../../middleware/error-handler.js";
import { StaffShift } from "database/staff-db.js";

import { Event } from "../../database/event-db.js";

const staffRouter: Router = Router();

/**
 * @api {post} /staff/attendance/ POST /staff/attendance/
 * @apiGroup Staff
 * @apiDescription Record staff attendance for an event.
 *
 * @apiHeader {String} Authorization JWT Token with staff permissions.
 *
 * @apiBody {String} eventId The unique identifier of the event.
 *
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 * {}
 *
 * @apiUse strongVerifyErrors
 * @apiError (403: Forbidden) {String} InvalidPermission Access denied for invalid permission.
 * @apiError (400: Bad Request) {String} InvalidParams Invalid or missing parameters.
 * @apiError (400: Bad Request) {String} EventExpired This particular event has expired.
 * @apiError (404: Not Found) {String} EventNotFound This event was not found
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 403 Forbidden
 *     {"error": "Forbidden"}
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 400 Bad Request
 *     {"error": "InvalidParams"}
 * @apiError (500: Internal Error) {String} InternalError Database operation failed.
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 500 Internal Server Error
 *     {"error": "InternalError"}
 */
staffRouter.post("/attendance/", strongJwtVerification(), async (req, res, next) => {
    const payload = res.locals.payload;

    const eventId: string | undefined = (req.body as AttendanceFormat).eventId;
    const userId: string = payload.id;
    // Only staff can mark themselves as attending these events
    if (!hasStaffPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "Forbidden"));
    }

    if (!eventId) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "InvalidParams"));
    }

    const event = await Models.Event.findOne({ eventId: eventId });

    if (!event) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "EventNotFound"));
    }

    const timestamp: number = Math.round(Date.now() / Config.MILLISECONDS_PER_SECOND);

    if (event.exp && event.exp <= timestamp) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "CodeExpired"));
    }

    await Models.UserAttendance.findOneAndUpdate({ userId: userId }, { $addToSet: { attendance: eventId } }, { upsert: true });
    await Models.EventAttendance.findOneAndUpdate({ eventId: eventId }, { $addToSet: { attendees: userId } }, { upsert: true });
    return res.status(StatusCode.SuccessOK).send({ status: "Success" });
});

staffRouter.get("/shift/", strongJwtVerification(), async (_, res, next) => {
    const payload = res.locals.payload;

    if (!hasStaffPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "Forbidden"));
    }

    const data: StaffShift | null = await Models.StaffShift.findOne({ userId: payload.id });

    if (!data) {
        return next(new RouterError(StatusCode.ServerErrorInternal, "ShiftNotFound"));
    }

    const shiftIds: string[] = data.shifts;

    const events: Event[] = await Models.Event.find({
        isStaff: true,
        eventId: { $in: shiftIds },
    });

    return res.status(StatusCode.SuccessOK).json(events);
});

staffRouter.post("/shift/", strongJwtVerification(), async (req, res, next) => {
    const payload = res.locals.payload;

    if (!hasStaffPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "Forbidden"));
    }

    const shift: StaffShift = req.body as StaffShift;

    if (!hasAdminPerms(payload) || !shift.userId) {
        shift.userId = payload.id;
    }

    if (!isValidStaffShiftFormat(shift)) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "InvalidParams"));
    }

    await Models.StaffShift.updateOne(
        { userId: shift.userId },
        {
            $push: {
                shifts: {
                    $each: shift.shifts,
                },
            },
        },
        { upsert: true, new: true },
    );

    return res.status(StatusCode.SuccessOK).json({ success: true });
});

export default staffRouter;
