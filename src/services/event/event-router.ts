import cors from "cors";
import { Request, Router } from "express";
import crypto from "crypto";
import { Response } from "express-serve-static-core";
import { Collection, Document, Filter, UpdateFilter } from "mongodb";

import Constants from "../../constants.js";
import databaseClient from "../../database.js";
import { strongJwtVerification, weakJwtVerification } from "../../middleware/verify-jwt.js";

import { hasAdminPerms, hasStaffPerms } from "../auth/auth-lib.js";
import { JwtPayload } from "../auth/auth-models.js";

import { EventDB, StaffDB, InternalEventSchema } from "./event-schemas.js";
import { eventExists, hasExpired, truncateToExternalEvent, updateExpiry } from "./event-lib.js";
import { InternalEvent, ExternalEvent } from "./event-models.js";
import { AttendanceFormat, isStaffEventFormat, isAttendeeEventFormat, BaseEventFormat, ExpirationFormat, isExpirationFormat } from "./event-formats.js";


const eventsRouter: Router = Router();
eventsRouter.use(cors({ origin: "*" }));


/**
 * @api {get} /event/staff GET /event/staff
 * @apiGroup Event
 * @apiDescription Get staff event details by its unique ID.
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
 *     "eventType": "WORKSHOP".
 * 	   "isStaff": true,
 * 	   "isPrivate": true,
 * 	   "isAsync": true,
 * 	   "displayOnStaffCheckIn": true,
 *   }
 * }
 *
 * @apiUse strongVerifyErrors
 * @apiError (403: Forbidden) {String} Forbidden Not a valid staff token.
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 403 Forbidden
 *     {"error": "PrivateEvent"}
 * @apiError (500: Internal Error) {String} InternalError Database operation failed.
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 500 Internal Server Error
 *     {"error": "InternalError"}
 */
eventsRouter.get("/staff/", strongJwtVerification, async (_: Request, res: Response) => {
	const payload: JwtPayload = res.locals.payload as JwtPayload;

	if (!hasStaffPerms(payload)) {
		return res.status(Constants.FORBIDDEN).send({ error: "Forbidden" });
	}

	// Get staff collection, and return all staff events
	const collection: Collection = databaseClient.db(Constants.EVENT_DB).collection(EventDB.STAFF_EVENTS);

	try {
		const staffEvents: InternalEventSchema[] = await collection.find().toArray() as InternalEventSchema[];
		return res.status(Constants.SUCCESS).send({ events: staffEvents });
	} catch (error) {
		return res.status(Constants.INTERNAL_ERROR).send({ error: "InternalError" });
	}
});


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
	const collection: Collection = databaseClient.db(Constants.EVENT_DB).collection(EventDB.ATTENDEE_EVENTS);
	const eventId: string | undefined = req.params.EVENTID;

	if (!eventId) {
		return res.redirect("/");
	}

	const payload: JwtPayload = res.locals.payload as JwtPayload;
	try {
		const isStaff: boolean = hasStaffPerms(payload);
		const event: InternalEventSchema = await collection.findOne({ id: eventId }) as InternalEventSchema;

		if (event.isPrivate) {
			// If event is private and a staff member is requesting this event, return the event. Else, give forbidden1
			if (isStaff) {
				return res.status(Constants.SUCCESS).send({ event: event });
			} else {
				return res.status(Constants.FORBIDDEN).send({ error: "PrivateEvent" });
			}
		} else {
			// Not a private event -> convert to Public event and return
			return res.status(Constants.SUCCESS).send({ event: truncateToExternalEvent(event) });
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
	if (!hasAdminPerms(res.locals.payload as JwtPayload)) {
		return res.status(Constants.FORBIDDEN).send({ error: "InvalidPermission" });
	}

	// Check if eventid field doesn't exist -> if not, returns error
	if (!eventId) {
		return res.status(Constants.BAD_REQUEST).send({ error: "InvalidParams" });
	}

	const publicCollection: Collection = databaseClient.db(Constants.EVENT_DB).collection(EventDB.ATTENDEE_EVENTS);
	const staffCollection: Collection = databaseClient.db(Constants.EVENT_DB).collection(EventDB.STAFF_EVENTS);

	// Perform a lazy delete on both databases, and return true if the operation succeeds
	try {
		await publicCollection.deleteOne({ id: eventId });
		await staffCollection.deleteOne({ id: eventId });
		return res.status(Constants.SUCCESS).send({ status: "Success" });
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
eventsRouter.post("/staff/attendance/", strongJwtVerification, async (req: Request, res: Response) => {
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


/**
 * @api {get} /event/ GET /event/
 * @apiGroup Event
 * @apiDescription Get all the publicly-available events. NOTE THAT THIS WILL CREATE DUPLICATE EVENTS IF CALLED TWICE.
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
	const collection: Collection = databaseClient.db(Constants.EVENT_DB).collection(EventDB.ATTENDEE_EVENTS);

	try {
		// Check if we have a JWT token passed in, and use that to define the query cursor
		const isStaff: boolean = hasStaffPerms(res.locals.payload as JwtPayload | undefined);
		const filter: Filter<Document> = isStaff ? { isStaff: { $ne: true } } : { isStaff: { $ne: true }, isPrivate: false };

		// Get collection from the database, and return it as an array
		const events: InternalEventSchema[] = await collection.find(filter).toArray() as InternalEventSchema[];
		const cleanedEvents: InternalEvent[] | ExternalEvent[] = isStaff ? events : events.map(truncateToExternalEvent);
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
 * @apiBody {string} name The name of the event.
 * @apiBody {string} description A description of the event.
 * @apiBody {number} startTime The start time of the event.
 * @apiBody {number} endTime The end time of the event.
 * @apiBody {Location[]} locations An array of locations associated with the event.
 * @apiBody {string} sponsor The sponsor of the event.
 * @apiBody {string} eventType The type of the event.
 * @apiBody {number} points The points associated with the event.
 * @apiBody {boolean} isAsync Indicates whether the event is asynchronous.
 * @apiBody {boolean} isPrivate Indicates whether the event is private.
 * @apiBody {boolean} isStaff Indicates whether the event is staff-only.
 * @apiBody {boolean} displayOnStaffCheckIn Indicates whether the event should be displayed on staff check-in.
 *
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
 * @apiSuccess {boolean} isPrivate Indicates whether the event is private.
 * @apiSuccess {boolean} isStaff Indicates whether the event is staff-only.
 * @apiSuccess {boolean} displayOnStaffCheckIn Indicates whether the event should be displayed on staff check-in.
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
	const payload: JwtPayload = res.locals.payload as JwtPayload;

	// Check if the token has staff permissions
	if (!hasAdminPerms(payload)) {
		return res.status(Constants.FORBIDDEN).send({ error: "InvalidPermission" });
	}

	const eventFormat: BaseEventFormat = req.body as BaseEventFormat;

	// If ID doesn't exist -> return the invalid parameters
	if (eventFormat.id) {
		return res.status(Constants.BAD_REQUEST).send({ error: "InvalidParams" });
	}

	eventFormat.id = crypto.randomBytes(Constants.EVENT_ID_BYTES).toString("hex");

	// Create base types, to be defined based on whether or not there's an isStaff field
	let eventCollection: Collection<Document>;
	let validRequestChecker: (event: BaseEventFormat) => boolean;

	// Get the function to execute to check if input format is right
	if (eventFormat.isStaff ?? false) {
		validRequestChecker = isStaffEventFormat;
		eventCollection = databaseClient.db(Constants.EVENT_DB).collection(EventDB.STAFF_EVENTS);
	} else {
		validRequestChecker = isAttendeeEventFormat;
		eventCollection = databaseClient.db(Constants.EVENT_DB).collection(EventDB.ATTENDEE_EVENTS);
	}

	// Check if the actual request is valid (based on the function passed in earlier)
	if (!validRequestChecker(eventFormat)) {
		return res.status(Constants.BAD_REQUEST).send({ error: "InvalidParams" });
	}

	// Try to update the database. Update the collection containing the event, and the expiration times
	const expCollection: Collection = databaseClient.db(Constants.EVENT_DB).collection(EventDB.EXPIRATIONS);
	try {
		await eventCollection.insertOne(eventFormat);
		await expCollection.insertOne({ eventId: eventFormat.id, exp: eventFormat.endTime });
		return res.status(Constants.SUCCESS).send({ ...eventFormat });
	} catch (error) {
		console.error(error);
		return res.status(Constants.INTERNAL_ERROR).send({ error: "DatabaseError" });
	}
});

/**
 * @api {get} /event/expiration/:EVENTID GET /event/expiration/:EVENTID
 * @apiGroup Event
 * @apiDescription Get the expiration time for requested event.
 *
 * @apiParam {String} EVENTID The unique identifier of the event.
 *
 * @apiSuccess (200: Success) {Json} event The existing event and expiration data.
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 * {
 *    "id": "52fdfc072182654f163f5f0f9a621d72",
 *    "exp": 1532202702,
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
 *     {"error": "InternalError"}
 */
eventsRouter.get("/expiration/:EVENTID", strongJwtVerification, async (req: Request, res: Response) => {
	const payload: JwtPayload = res.locals.payload as JwtPayload;
	
	if (!hasStaffPerms(payload)) {
		return res.status(Constants.FORBIDDEN).send({ error: "InvalidPermission" });
	}

	// Check if the request information is valid
	const eventId: string | undefined = req.params.EVENTID;

	if (!await(eventExists(eventId)) ){
		return res.status(Constants.BAD_REQUEST).send({ error: "InvalidParams" });
	}

	try {
		// Get collection from the database, and return expData
		const collection: Collection = databaseClient.db(Constants.EVENT_DB).collection(EventDB.EXPIRATIONS);
		const expData: InternalEventSchema = await collection.findOne({ eventId: eventId }) as InternalEventSchema;
		return res.status(Constants.SUCCESS).send({ ...expData });
	} catch {
		return res.status(Constants.INTERNAL_ERROR).send({ error: "InternalError" });
	}
});

/**
 * @api {put} /event/expiration/ PUT /event/expiration/
 * @apiGroup Event
 * @apiDescription Create a new expiration entry, or update the expiration entry.
 *
 * @apiBody {string} id The unique identifier of the event.
 * @apiBody {number} exp Time to set the expiration to, IN MILLISECONDS.
 *
 *
 * @apiSuccess (200: Success) {Json} event The created or updated expiration data.
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 * {
 *    "id": "52fdfc072182654f163f5f0f9a621d72",
 *    "exp": 1532202702,
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
 *     {"error": "InternalError"}
 */
eventsRouter.put("/expiration/", strongJwtVerification, async (req: Request, res: Response) => {
	const payload: JwtPayload = res.locals.payload as JwtPayload;
	
	if (!hasAdminPerms(payload)) {
		return res.status(Constants.FORBIDDEN).send({ error: "InvalidPermission" });
	}

	// Check if the request information is valid
	const expData: ExpirationFormat = req.body as ExpirationFormat;
	if (!isExpirationFormat(expData)) {
		return res.status(Constants.BAD_REQUEST).send({ error: "InvalidParams" });
	}

	// Update the database, and return true if it passes. Else, return false.
	try {
		await updateExpiry(expData);
		return res.status(Constants.SUCCESS).send({ ...expData });
	} catch (error) {
		console.error(error);
		return res.status(Constants.INTERNAL_ERROR).send({ error: "InternalError" });
	}
});


/**
 * @api {put} /event/ PUT /event/
 * @apiGroup Event
 * @apiDescription Create a new event or update an existing event.
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
 * @apiBody {boolean} isPrivate Indicates whether the event is private.
 * @apiBody {boolean} displayOnStaffCheckIn Indicates whether the event should be displayed on staff check-in.
 * @apiBody {boolean} isStaff Indicates whether the event is staff-only.
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
 *     {"error": "InternalError"}
 */
eventsRouter.put("/", strongJwtVerification, async (req: Request, res: Response) => {
	const payload: JwtPayload = res.locals.payload as JwtPayload;

	// Check if the token has elevated permissions
	if (!hasAdminPerms(payload)) {
		return res.status(Constants.FORBIDDEN).send({ error: "InvalidPermission" });
	}

	// Verify that the input format is valid to create a new event
	const eventFormat: BaseEventFormat = req.body as BaseEventFormat;

	// TODO: Check to ensure that the event exists

	// Create base types, to be defined based on whether or not there's an isStaff field
	let collection: Collection<Document>;
	let validRequestChecker: (event: BaseEventFormat) => boolean;

	// Check to ensure that ID isn't being passed in
	if (eventFormat._id) {
		delete eventFormat._id;
	}

	// Get the function to execute to check if input format is right
	if (eventFormat.isStaff ?? false) {
		validRequestChecker = isStaffEventFormat;
		collection = databaseClient.db(Constants.EVENT_DB).collection(EventDB.STAFF_EVENTS);
	} else {
		validRequestChecker = isAttendeeEventFormat;
		collection = databaseClient.db(Constants.EVENT_DB).collection(EventDB.ATTENDEE_EVENTS);
	}

	// Check if the actual request is valid (based on the function passed in earlier)
	if (!validRequestChecker(eventFormat) || !await eventExists(eventFormat.id)) {
		return res.status(Constants.BAD_REQUEST).send({ error: "InvalidParams" });
	}

	// Generate the filter to update the event
	const updateFilter: UpdateFilter<Document> = {
		$set: {
			...eventFormat,
		},
	};

	// Try to update the database, if possible
	try {
		await collection.updateOne({ id: eventFormat.id }, updateFilter, { upsert: true });
		return res.status(Constants.SUCCESS).send({ ...eventFormat });
	} catch (error) {
		console.error(error);
		return res.status(Constants.INTERNAL_ERROR).send({ error: "InternalError" });
	}
});


export default eventsRouter;
