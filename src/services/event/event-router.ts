import cors from "cors";
import { Request, Router } from "express";
import { Response } from "express-serve-static-core";
import { Collection, Document, Filter } from "mongodb";

import Constants from "../../constants.js";
import databaseClient from "../../database.js";
import { weakJwtVerification } from "../../middleware/verify-jwt.js";

import { hasElevatedPerms } from "../auth/auth-lib.js";
import { JwtPayload } from "../auth/auth-models.js";

import { PrivateEventSchema, PublicEventSchema } from "./event-schemas.js";
import { truncateToPublicEvent } from "./event-lib.js";
import { PrivateEvent, PublicEvent } from "./event-models.js";


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



export default eventsRouter;
