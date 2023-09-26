import cors from "cors";
import { Request, Router } from "express";
import crypto from "crypto";
import { Response } from "express-serve-static-core";
import { Collection, Document, Filter, UpdateFilter } from "mongodb";

import Constants from "../../constants.js";
import databaseClient from "../../database.js";
import { strongJwtVerification, weakJwtVerification } from "../../middleware/verify-jwt.js";

import { hasElevatedPerms } from "../auth/auth-lib.js";
import { JwtPayload } from "../auth/auth-models.js";

import { EventDB, StaffDB, PrivateEventSchema, PublicEventSchema } from "./event-schemas.js";
import { truncateToPublicEvent } from "./event-lib.js";
import { PrivateEvent, PublicEvent } from "./event-models.js";
import { AttendanceFormat, EventFormat, isEventFormat } from "./event-formats.js";


const eventsRouter: Router = Router();
eventsRouter.use(cors({ origin: "*" }));


/**
 * @api {get} /event/:EVENTID GET /event/:EVENTID
 * @apiGroup Event
 * @apiDescription Get event details by its unique ID.
 *
 * @apiParam {String} EVENTID The unique identifier of the event.
 *
 * @apiSuccess (200: Success) {Json} event The event details.
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 * {
 *   "event": {
 *     "id": "52fdfc072182654f163f5f0f9a621d72",
 *     "name": "Example Event 10",
 *     "description": "This is a description",
 *     "startTime": 1532202702,
 *     "endTime": 1532212702,
 *     "locations": [
 *       {
 *         "description": "Example Location",
 *         "tags": ["SIEBEL0", "ECEB1"],
 *         "latitude": 40.1138,
 *         "longitude": -88.2249
 *       }
 *     ],
 *     "sponsor": "Example sponsor",
 *     "eventType": "WORKSHOP"
 *   }
 * }
 *
 * @apiUse weakVerifyErrors
 * @apiError (403: Forbidden) {String} PrivateEvent Access denied for private event.
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 403 Forbidden
 *     {"error": "PrivateEvent"}
 * @apiError (500: Internal Error) {String} InternalError Database operation failed.
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 500 Internal Server Error
 *     {"error": "InternalError"}
 */
eventsRouter.get("/:EVENTID/", weakJwtVerification, async (req: Request, res: Response) => {
	const collection: Collection = databaseClient.db(Constants.EVENT_DB).collection(EventDB.EVENTS);
	const eventId: string | undefined = req.params.EVENTID;

	if (!eventId) {
		return res.redirect("/");
	}

	try {
		const isElevated: boolean = hasElevatedPerms(res.locals.payload as JwtPayload | undefined);
		const event: PublicEventSchema = await collection.findOne({ id: eventId }) as PublicEventSchema;

		if (event.isPrivate) {
			// If event is private and we're elevated, return the event -> else, return forbidden
			if (isElevated) {
				return res.status(Constants.SUCCESS).send({ event: event });
			} else {
				return res.status(Constants.FORBIDDEN).send({ error: "PrivateEvent" });
			}
		} else {
			// Not a private event -> convert to Public event and return
			return res.status(Constants.SUCCESS).send({ event: truncateToPublicEvent(event) });
		}
	} catch {
		return res.status(Constants.INTERNAL_ERROR).send({ error: "InternalError" });
	}
});


/**
 * @api {delete} /event/:EVENTID DELETE /event/:EVENTID
 * @apiGroup Event
 * @apiDescription Delete an event by its unique ID.
 *
 * @apiParam {String} EVENTID The unique identifier of the event to be deleted.
 *
 * @apiSuccess (200: Success) {String} message Event successfully deleted.
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 * {}
 *
 * @apiUse strongVerifyErrors
 * @apiError (403: Forbidden) {String} InvalidPermission Access denied for invalid permission.
 * @apiError (400: Bad Request) {String} InvalidParams Invalid or missing EVENTID parameter.
 * @apiError (500: Internal Error) {String} InternalError Database operation failed.
 */
eventsRouter.delete("/:EVENTID/", strongJwtVerification, async (req: Request, res: Response) => {
	const eventId: string | undefined = req.params.EVENTID;

	// Check if request sender has permission to delete the event
	if (!hasElevatedPerms(res.locals.payload as JwtPayload)) {
		return res.status(Constants.FORBIDDEN).send({ error: "InvalidPermission" });
	}

	// Check if event doesn't exist -> if not, returns error
	if (!eventId) {
		return res.status(Constants.BAD_REQUEST).send({ error: "InvalidParams" });
	}

	const collection: Collection = databaseClient.db(Constants.EVENT_DB).collection(EventDB.EVENTS);

	// Perform a lazy delete, and return true if not existent
	try {
		await collection.deleteOne({ id: eventId });
		return res.sendStatus(Constants.SUCCESS);
	} catch (error) {
		console.error(error);
		return res.status(Constants.INTERNAL_ERROR).send({ error: "InternalError" });
	}
});


/**
 * @api {post} /event/staff/attendance/ POST /event/staff/attendance/
 * @apiGroup Event
 * @apiDescription Record staff attendance for an event.
 *
 * @apiHeader {String} Authorization JWT Token with elevated permissions.
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
eventsRouter.post("/staff/attendance/", strongJwtVerification, async (req: Request, res: Response) => {
	const token: JwtPayload | undefined = res.locals.payload as JwtPayload;
	
	const eventId: string | undefined = (req.body as AttendanceFormat).eventId ;

	// Only staff can mark themselves as attending these events
	if (!hasElevatedPerms(token)) {
		return res.status(Constants.FORBIDDEN).send({ error: "Forbidden" });
	}

	if (!eventId) {
		return res.status(Constants.BAD_REQUEST).send({ error: "InvalidParams" });
	}

	const eventsCollection: Collection = databaseClient.db(Constants.EVENT_DB).collection(EventDB.STAFF_ATTENDANCE);
	const staffCollection: Collection = databaseClient.db(Constants.STAFF_DB).collection(StaffDB.ATTENDANCE);

	try {
		await eventsCollection.updateOne({ id: eventId }, { "$addToSet": { "attendees": token.id } }, { upsert: true });
		await staffCollection.updateOne({ id: token.id }, { "$addToSet": { "attendance": eventId } }, { upsert: true });
		return res.sendStatus(Constants.SUCCESS);
	} catch (error) {
		console.error(error);
		return res.status(Constants.INTERNAL_ERROR).send({ error: "InternalError" });
	}
});


/**
 * @api {get} /event/ GET /event/
 * @apiGroup Event
 * @apiDescription Get all the publicly-available events
 * @apiSuccess (200: Success) {Json} events All publicly-facing events.
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
   {
		  "events": [
				{
					"id": "52fdfc072182654f163f5f0f9a621d72",
					"name": "Example Event 10",
					"description": "This is a description",
					"startTime": 1532202702,
					"endTime": 1532212702,
					"locations": [
						{
							"description": "Example Location",
							"tags": ["SIEBEL0", "ECEB1"],
							"latitude": 40.1138,
							"longitude": -88.2249
						}
					],
					"sponsor": "Example sponsor",
					"eventType": "WORKSHOP"
				},
				{
					"id": "52fdfcab71282654f163f5f0f9a621d72",
					"name": "Example Event 11",
					"description": "This is another description",
					"startTime": 1532202702,
					"endTime": 1532212702,
					"locations": [
						{
							"description": "Example Location",
							"tags": ["SIEBEL3"],
							"latitude": 40.1138,
							"longitude": -88.2249
						}
					],
					"sponsor": "Example sponsor",
					"eventType": "WORKSHOP"
				}
		  ]
   }
 *
 * @apiUse weakVerifyErrors
 * @apiError (500: Internal Error) {String} InternalError Database operation failed.
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 500 Internal Server Error
 *     {"error": "InternalError"}
 */
eventsRouter.get("/", weakJwtVerification, async (_: Request, res: Response) => {
	const collection: Collection = databaseClient.db(Constants.EVENT_DB).collection(EventDB.EVENTS);

	try {
		// Check if we have a JWT token passed in, and use that to define the query cursor
		const isElevated: boolean = hasElevatedPerms(res.locals.payload as JwtPayload | undefined);
		const filter: Filter<Document> = isElevated ? {} : { isPrivate: false };

		// Get collection from the database, and return it as an array
		const events: PrivateEventSchema[] = await collection.find(filter).toArray() as PrivateEventSchema[];
		const cleanedEvents: PrivateEvent[] | PublicEvent[] = isElevated ? events : events.map(truncateToPublicEvent);
		return res.status(Constants.SUCCESS).send({ events: cleanedEvents });
	} catch {
		return res.status(Constants.INTERNAL_ERROR).send({ error: "InternalError" });
	}
});


/**
 * @api {post} /event/ POST /event/
 * @apiGroup Event
 * @apiDescription Create a new event or update an existing event.
 *
 * @apiBody {boolean} isPrivate Indicates whether the event is private.
 * @apiBody {boolean} displayOnStaffCheckIn Indicates whether the event should be displayed on staff check-in.
 * @apiBody {string} id The unique identifier of the event.
 * @apiBody {string} name The name of the event.
 * @apiBody {string} description A description of the event.
 * @apiBody {number} startTime The start time of the event.
 * @apiBody {number} endTime The end time of the event.
 * @apiBody {Location[]} locations An array of locations associated with the event.
 * @apiBody {string} sponsor The sponsor of the event.
 * @apiBody {string} eventType The type of the event.
 * @apiBody {number} points The points associated with the event.
 * @apiBody {boolean} isAsync Indicates whether the event is asynchronous.
 *
 * @apiSuccess {boolean} isPrivate Indicates whether the event is private.
 * @apiSuccess {boolean} displayOnStaffCheckIn Indicates whether the event should be displayed on staff check-in.
 * @apiSuccess {string} id The unique identifier of the event.
 * @apiSuccess {string} name The name of the event.
 * @apiSuccess {string} description A description of the event.
 * @apiSuccess {number} startTime The start time of the event.
 * @apiSuccess {number} endTime The end time of the event.
 * @apiSuccess {Location[]} locations An array of locations associated with the event.
 * @apiSuccess {string} sponsor The sponsor of the event.
 * @apiSuccess {string} eventType The type of the event.
 * @apiSuccess {number} points The points associated with the event.
 * @apiSuccess {boolean} isAsync Indicates whether the event is asynchronous.
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 * {
*     "name": "Example Event 10",
*     "description": "This is a description",
*     "startTime": 1532202702,
*     "endTime": 1532212702,
*     "locations": [
*       {
*         "description": "Example Location",
*         "tags": ["SIEBEL0", "ECEB1"],
*         "latitude": 40.1138,
*         "longitude": -88.2249
*       }
*     ],
*     "sponsor": "Example sponsor",
*     "eventType": "WORKSHOP"
 * }
 * @apiUse strongVerifyErrors
 * @apiError (403: Forbidden) {String} InvalidPermission Access denied for invalid permission.
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 403 Forbidden
 *     {"error": "InvalidPermission"}
 * @apiError (400: Bad Request) {String} InvalidParams Invalid parameters for the event.
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 400 Bad Request
 *     {"error": "InvalidParams"}
 * @apiError (500: Internal Error) {String} InternalError Database operation failed.
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 500 Internal Server Error
 *     {"error": "DatabaseError"}
 */
eventsRouter.post("/", strongJwtVerification, async (req: Request, res: Response) => {
	const token: JwtPayload = res.locals.payload as JwtPayload;

	// Check if the token has elevated permissions
	if (!hasElevatedPerms(token)) {
		return res.status(Constants.FORBIDDEN).send({ error: "InvalidPermission" });
	}

	// Verify that the input format is valid to create a new event or update it
	const eventFormat: EventFormat = req.body as EventFormat;
	eventFormat.id = crypto.randomBytes(Constants.EVENT_ID_LENGTH).toString("hex");
	if (!isEventFormat(eventFormat)) {
		return res.status(Constants.BAD_REQUEST).send({ error: "InvalidParams" });
	}

	const collection: Collection<Document> = databaseClient.db(Constants.EVENT_DB).collection(EventDB.EVENTS);

	// Try to update the database, if possivle
	try {
		await collection.insertOne(eventFormat);
		return res.status(Constants.SUCCESS).send({ ...eventFormat });
	} catch (error) {
		console.error(error);
		return res.status(Constants.INTERNAL_ERROR).send({ error: "DatabaseError" });
	}
});


/**
 * @api {put} /event/ PUT /event/
 * @apiGroup Event
 * @apiDescription Create a new event or update an existing event.
 *
 * @apiBody {boolean} isPrivate Indicates whether the event is private.
 * @apiBody {boolean} displayOnStaffCheckIn Indicates whether the event should be displayed on staff check-in.
 * @apiBody {string} id The unique identifier of the event.
 * @apiBody {string} name The name of the event.
 * @apiBody {string} description A description of the event.
 * @apiBody {number} startTime The start time of the event.
 * @apiBody {number} endTime The end time of the event.
 * @apiBody {Location[]} locations An array of locations associated with the event.
 * @apiBody {string} sponsor The sponsor of the event.
 * @apiBody {string} eventType The type of the event.
 * @apiBody {number} points The points associated with the event.
 * @apiBody {boolean} isAsync Indicates whether the event is asynchronous.
 *
 *
 * @apiSuccess (200: Success) {Json} event The created or updated event.
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 * {
 *   "event": {
 *     "id": "52fdfc072182654f163f5f0f9a621d72",
 *     "name": "Example Event 10",
 *     "description": "This is a description",
 *     "startTime": 1532202702,
 *     "endTime": 1532212702,
 *     "locations": [
 *       {
 *         "description": "Example Location",
 *         "tags": ["SIEBEL0", "ECEB1"],
 *         "latitude": 40.1138,
 *         "longitude": -88.2249
 *       }
 *     ],
 *     "sponsor": "Example sponsor",
 *     "eventType": "WORKSHOP"
 *   }
 * }
 * @apiUse strongVerifyErrors
 * @apiError (403: Forbidden) {String} InvalidPermission Access denied for invalid permission.
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 403 Forbidden
 *     {"error": "InvalidPermission"}
 * @apiError (400: Bad Request) {String} InvalidParams Invalid parameters for the event.
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 400 Bad Request
 *     {"error": "InvalidParams"}
 * @apiError (500: Internal Error) {String} InternalError Database operation failed.
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 500 Internal Server Error
 *     {"error": "DatabaseError"}
 */
eventsRouter.put("/", strongJwtVerification, async (req: Request, res: Response) => {
	const token: JwtPayload = res.locals.payload as JwtPayload;

	// Check if the token has elevated permissions
	if (!hasElevatedPerms(token)) {
		return res.status(Constants.FORBIDDEN).send({ error: "InvalidPermission" });
	}

	// Verify that the input format is valid to create a new event or update it
	const eventFormat: EventFormat = req.body as EventFormat;
	if (!isEventFormat(eventFormat)) {
		return res.status(Constants.BAD_REQUEST).send({ error: "InvalidParams" });
	}

	const collection: Collection<Document> = databaseClient.db(Constants.EVENT_DB).collection(EventDB.EVENTS);

	const updateFilter: UpdateFilter<PrivateEventSchema> = {
		$set: {
			...eventFormat,
		},
	};

	// Try to update the database, if possivle
	try {
		await collection.updateOne(updateFilter, eventFormat, { upsert: true });
		return res.status(Constants.SUCCESS).send({ ...eventFormat });
	} catch (error) {
		console.error(error);
		return res.status(Constants.INTERNAL_ERROR).send({ error: "DatabaseError" });
	}
});


export default eventsRouter;
