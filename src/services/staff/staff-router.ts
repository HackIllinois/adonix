import { Router, Request, Response } from "express";

import { strongJwtVerification } from "../../middleware/verify-jwt.js";
import { JwtPayload } from "../auth/auth-models.js";
import { hasStaffPerms } from "../auth/auth-lib.js";

import { AttendanceFormat } from "./staff-formats.js";
import Constants from "../../constants.js";

import { EventMetadata } from "../../database/event-db.js";
import Models from "../../database/models.js";

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
staffRouter.post("/attendance/", strongJwtVerification, async (req: Request, res: Response) => {
    const payload: JwtPayload | undefined = res.locals.payload as JwtPayload;

    const eventId: string | undefined = (req.body as AttendanceFormat).eventId;
    const userId: string = payload.id;
    // Only staff can mark themselves as attending these events
    if (!hasStaffPerms(payload)) {
        return res.status(Constants.FORBIDDEN).send({ error: "Forbidden" });
    }

    if (!eventId) {
        return res.status(Constants.BAD_REQUEST).send({ error: "InvalidParams" });
    }

    const metadata: EventMetadata | null = await Models.EventMetadata.findOne({ eventId: eventId });

    if (!metadata) {
        return res.status(Constants.BAD_REQUEST).send({ error: "EventNotFound" });
    }

    const timestamp: number = Math.round(Date.now() / Constants.MILLISECONDS_PER_SECOND);
    console.log(metadata.exp, timestamp);

    if (metadata.exp <= timestamp) {
        return res.status(Constants.BAD_REQUEST).send({ error: "CodeExpired" });
    }

    await Models.UserAttendance.findOneAndUpdate({ userId: userId }, { $addToSet: { attendance: eventId } }, { upsert: true });
    await Models.EventAttendance.findOneAndUpdate({ eventId: eventId }, { $addToSet: { attendees: userId } }, { upsert: true });
    return res.status(Constants.SUCCESS).send({ status: "Success" });
});

export default staffRouter;
