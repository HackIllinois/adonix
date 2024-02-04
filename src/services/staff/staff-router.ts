import { Router, Request, Response } from "express";

import { strongJwtVerification } from "../../middleware/verify-jwt.js";
import { JwtPayload } from "../auth/auth-models.js";
import { hasAdminPerms, hasStaffPerms } from "../auth/auth-lib.js";

import { AttendanceFormat, isValidStaffShiftFormat } from "./staff-formats.js";
import Config from "../../config.js";

import Models from "../../database/models.js";
import { StatusCode } from "status-code-enum";
import { NextFunction } from "express-serve-static-core";
import { RouterError } from "../../middleware/error-handler.js";
import { StaffShift } from "database/staff-db.js";

import { Event } from "../../database/event-db.js";
import { performCheckIn } from "./staff-lib.js";

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
staffRouter.post("/attendance/", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const payload: JwtPayload | undefined = res.locals.payload as JwtPayload;

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

/**
 * @api {put} /staff/scan-attendee/ PUT /staff/scan-attendee/
 * @apiGroup Staff
 * @apiDescription Record user attendance for an event.
 *
 * @apiHeader {String} Authorization JWT Token with staff permissions.
 *
 * @apiBody {String} userId The attendee to check in.
 * @apiBody {String} eventId The unique identifier of the event.
 *
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 * {success: true}
 *
 * @apiUse strongVerifyErrors
 * @apiError (403: Forbidden) {String} InvalidPermission Access denied for invalid permission.
 * @apiError (400: Bad Request) {String} InvalidParams Invalid or missing parameters.
 * @apiError (400: Bad Request) {String} AlreadyCheckedIn Attendee has already been checked in for this event.
 * @apiError (404: Not Found) {String} EventNotFound This event was not found
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 403 Forbidden
 *     {"error": "Forbidden"}
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 400 Bad Request
 *     {"error": "InvalidParams"}
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 400 Bad Request
 *     {"error": "AlreadyCheckedIn"}
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 404 Not Found
 *     {"error": "EventNotFound"}
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 424 Failed Dependency
 *     {"error": "NoRegistrationData"}
 */
staffRouter.put("/scan-attendee/", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const payload: JwtPayload | undefined = res.locals.payload as JwtPayload;
    const userId: string | undefined = req.body.userId;
    const eventId: string | undefined = req.body.eventId;

    if (!hasStaffPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "Forbidden"));
    }

    if (!userId || !eventId) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "InvalidParams"));
    }

    const result = await performCheckIn(eventId, userId);

    if (!result.success) {
        return next(result.error);
    }

    const registrationData = await Models.RegistrationApplication.findOne({ userId: userId }).select("dietaryRestrictions");

    if (!registrationData) {
        return next(new RouterError(StatusCode.ClientErrorFailedDependency, "NoRegistrationData"));
    }
    const dietaryRestrictions = registrationData["dietaryRestrictions"];

    return res.status(StatusCode.SuccessOK).json({ success: true, dietaryRestrictions: dietaryRestrictions });
});

/**
 * @api {get} /staff/shift/ GET /staff/shift/
 * @apiGroup Staff
 * @apiDescription Get all shifts for a staff
 *
 * @apiHeader {String} Authorization JWT Token with staff permissions.
 *
 *
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 * {
    "shifts": [
        {
            "isPro": false,
            "_id": "65b1a1d8f01ffc67a27d6f09",
            "eventId": "651df5d3b9dfdaceb46a3120",
            "isStaff": true,
            "name": "Test Staff Event 1",
            "description": "Staff",
            "startTime": 1698038079,
            "endTime": 1698038079,
            "eventType": "OTHER",
            "exp": 10000,
            "locations": [],
            "isAsync": false,
            "mapImageUrl": "test",
            "points": 0,
            "isPrivate": true,
            "displayOnStaffCheckIn": false
        }
    ]
 * }
 * @apiUse strongVerifyErrors
 * @apiError (403: Forbidden) {String} InvalidPermission Access denied for invalid permission.
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 403 Forbidden
 *     {"error": "Forbidden"}
 */

staffRouter.get("/shift/", strongJwtVerification, async (_: Request, res: Response, next: NextFunction) => {
    const payload: JwtPayload | undefined = res.locals.payload as JwtPayload;

    if (!hasStaffPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "Forbidden"));
    }

    const data: StaffShift | null = await Models.StaffShift.findOne({ userId: payload.id });

    if (!data) {
        return res.status(StatusCode.SuccessOK).json({ shifts: [] });
    }

    const shiftIds: string[] = data.shifts;

    const events: Event[] = await Models.Event.find({
        isStaff: true,
        eventId: { $in: shiftIds },
    });

    return res.status(StatusCode.SuccessOK).json({ shifts: events });
});

/**
 * @api {post} /staff/event/ POST /staff/event/
 * @apiGroup Staff
 * @apiDescription Add shifts for a given staff member
 *
 * @apiHeader {String} Authorization JWT Token with staff/admin permissions.
 *
 * @apiBody {String} userId (optional - admin only) The userId of the staff to add shifts for
 * @apiBody {String[]} shifts String[] of shift IDs
 *
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 * {success: true}
 *
 * @apiUse strongVerifyErrors
 * @apiError (403: Forbidden) {String} InvalidPermission Access denied for invalid permission.
 * @apiError (400: Bad Request) {String} InvalidParams Invalid or missing parameters.
 */

staffRouter.post("/shift/", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const payload: JwtPayload | undefined = res.locals.payload as JwtPayload;

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
