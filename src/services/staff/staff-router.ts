import { Collection } from "mongodb";
import { Router, Request, Response } from "express";

import { strongJwtVerification } from "../../middleware/verify-jwt.js";
import { JwtPayload } from "../auth/auth-models.js";
import { hasStaffPerms } from "../auth/auth-lib";

import { hasExpired } from "../event/event-lib";
import { AttendanceFormat } from "../event/event-formats.js";
import { EventDB, StaffDB } from "../event/event-schemas.js";

import Constants from "../../constants.js";
import databaseClient from "../../database.js";


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

	// Only staff can mark themselves as attending these events
	if (!hasStaffPerms(payload)) {
		return res.status(Constants.FORBIDDEN).send({ error: "Forbidden" });
	}

	if (!eventId) {
		return res.status(Constants.BAD_REQUEST).send({ error: "InvalidParams" });
	}

	if (await hasExpired(eventId)) {
		return res.status(Constants.BAD_REQUEST).send({ error: "EventExpired" });
	}

	const eventsCollection: Collection = databaseClient.db(Constants.EVENT_DB).collection(EventDB.STAFF_ATTENDANCE);
	const staffCollection: Collection = databaseClient.db(Constants.STAFF_DB).collection(StaffDB.ATTENDANCE);

	try {
		await eventsCollection.updateOne({ id: eventId }, { "$addToSet": { "attendees": payload.id } }, { upsert: true });
		await staffCollection.updateOne({ id: payload.id }, { "$addToSet": { "attendance": eventId } }, { upsert: true });
		return res.status(Constants.SUCCESS).send({ status: "Success" });
	} catch (error) {
		console.error(error);
		return res.status(Constants.INTERNAL_ERROR).send({ error: "InternalError" });
	}
});


export default staffRouter;
