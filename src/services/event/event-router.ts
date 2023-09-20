import cors from "cors";
import { Request, Router } from "express";
import { Response } from "express-serve-static-core";
import { Collection, Document, Filter, UpdateFilter } from "mongodb";

import Constants from "../../constants.js";
import databaseClient from "../../database.js";
import { strongJwtVerification, weakJwtVerification } from "../../middleware/verify-jwt.js";

import { hasElevatedPerms } from "../auth/auth-lib.js";
import { JwtPayload } from "../auth/auth-models.js";

import { PrivateEventSchema, PublicEventSchema } from "./event-schemas.js";
import { truncateToPublicEvent } from "./event-lib.js";
import { PrivateEvent, PublicEvent } from "./event-models.js";
import { EventFormat, isEventFormat } from "./event-formats.js";


const eventsRouter: Router = Router();
eventsRouter.use(cors({ origin: "*" }));


/**
 * @api {get} /event/:EVENTID GET /event/:EVENTID
 * @apiName Get Event by ID
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
eventsRouter.get("/:EVENTID", weakJwtVerification, async (req: Request, res: Response) => {
	const collection: Collection = databaseClient.db("event").collection("events");
	const eventId: string | undefined = req.params.EVENTID;

	if (!eventId) {
		res.redirect("/");
	}

	try {
		const isElevated: boolean = hasElevatedPerms(res.locals.payload as JwtPayload | undefined);
		const event: PublicEventSchema = await collection.findOne({ id: eventId }) as PublicEventSchema;

		if (event.isPrivate) {
			// If event is private and we're elevated, return the event -> else, return forbidden
			if (isElevated) {
				res.status(Constants.SUCCESS).send({ event: event });
			} else {
				res.status(Constants.FORBIDDEN).send({ error: "PrivateEvent" });
			}
		} else {
			// Not a private event -> convert to Public event and return
			res.status(Constants.SUCCESS).send({ event: truncateToPublicEvent(event) });
		}
	} catch {
		res.status(Constants.INTERNAL_ERROR).send({ error: "InternalError" });
	}
});



/**
 * @api {get} /event/ GET /event/
 * @apiName Event
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
	const collection: Collection = databaseClient.db("event").collection("events");

	try {
		// Check if we have a JWT token passed in, and use that to define the query cursor
		const isElevated: boolean = hasElevatedPerms(res.locals.payload as JwtPayload | undefined);
		const filter: Filter<Document> = isElevated ? {} : { isPrivate: false };

		// Get collection from the database, and return it as an array
		const events: PrivateEventSchema[] = await collection.find(filter).toArray() as PrivateEventSchema[];
		const cleanedEvents: PrivateEvent[] | PublicEvent[] = isElevated ? events : events.map(truncateToPublicEvent);
		res.status(Constants.SUCCESS).send({ events: cleanedEvents });
	} catch {
		res.status(Constants.INTERNAL_ERROR).send({ error: "InternalError" });
	}
});


/**
 * @api {post} /event/ POST /event/
 * @apiName Create or Update Event
 * @apiGroup Event
 * @apiDescription Create a new event or update an existing event.
 *
 * @apiParam {boolean} isPrivate Indicates whether the event is private.
 * @apiParam {boolean} displayOnStaffCheckIn Indicates whether the event should be displayed on staff check-in.
 * @apiParam {string} id The unique identifier of the event.
 * @apiParam {string} name The name of the event.
 * @apiParam {string} description A description of the event.
 * @apiParam {number} startTime The start time of the event.
 * @apiParam {number} endTime The end time of the event.
 * @apiParam {Location[]} locations An array of locations associated with the event.
 * @apiParam {string} sponsor The sponsor of the event.
 * @apiParam {string} eventType The type of the event.
 * @apiParam {number} points The points associated with the event.
 * @apiParam {boolean} isAsync Indicates whether the event is asynchronous.
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
eventsRouter.post("/", strongJwtVerification, async (req: Request, res: Response) => {
	const token: JwtPayload = res.locals.payload as JwtPayload;

	// Check if the token has elevated permissions
	if (!hasElevatedPerms(token)) {
		res.status(Constants.FORBIDDEN).send({ error: "InvalidPermission" });
	}


	// Verify that the input format is valid to create a new event or update it
	const eventFormat: EventFormat = req.body as EventFormat;
	if (!isEventFormat(eventFormat)) {
		res.status(Constants.BAD_REQUEST).send({ error: "InvalidParams" });
	}

	const collection: Collection<Document> = databaseClient.db(Constants.EVENT_DB).collection(Constants.EVENT_EVENTS);

	// Try to update the database, if possivle
	try {
		await collection.insertOne(eventFormat);
		res.status(Constants.SUCCESS).send({ ...eventFormat });
	} catch (error) {
		console.error(error);
		res.status(Constants.INTERNAL_ERROR).send({ error: "DatabaseError" });
	}
});


/**
 * @api {put} /event/ PUT /event/
 * @apiName Create or Update Event
 * @apiGroup Event
 * @apiDescription Create a new event or update an existing event.
 *
 * @apiParam {boolean} isPrivate Indicates whether the event is private.
 * @apiParam {boolean} displayOnStaffCheckIn Indicates whether the event should be displayed on staff check-in.
 * @apiParam {string} id The unique identifier of the event.
 * @apiParam {string} name The name of the event.
 * @apiParam {string} description A description of the event.
 * @apiParam {number} startTime The start time of the event.
 * @apiParam {number} endTime The end time of the event.
 * @apiParam {Location[]} locations An array of locations associated with the event.
 * @apiParam {string} sponsor The sponsor of the event.
 * @apiParam {string} eventType The type of the event.
 * @apiParam {number} points The points associated with the event.
 * @apiParam {boolean} isAsync Indicates whether the event is asynchronous.
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
		res.status(Constants.FORBIDDEN).send({ error: "InvalidPermission" });
	}

	// Verify that the input format is valid to create a new event or update it
	const eventFormat: EventFormat = req.body as EventFormat;
	if (!isEventFormat(eventFormat)) {
		res.status(Constants.BAD_REQUEST).send({ error: "InvalidParams" });
	}

	const collection: Collection<Document> = databaseClient.db(Constants.EVENT_DB).collection(Constants.EVENT_EVENTS);

	const updateFilter: UpdateFilter<PrivateEventSchema> = {
		$set: {
			...eventFormat,
		},
	};

	// Try to update the database, if possivle
	try {
		await collection.updateOne(updateFilter, eventFormat, { upsert: true });
		res.status(Constants.SUCCESS).send({ ...eventFormat });
	} catch (error) {
		console.error(error);
		res.status(Constants.INTERNAL_ERROR).send({ error: "DatabaseError" });
	}
});




export default eventsRouter;
