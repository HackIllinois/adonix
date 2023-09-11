import cors from "cors";

import { Request, Router } from "express";
import { Response } from "express-serve-static-core";
import { Collection } from "mongodb";

import Constants from "../../constants.js";
import DatabaseHelper from "../../database.js";

import { EventSchema } from "./event-schemas.js";
import { camelcaseEvent } from "./event-lib.js";


const eventsRouter: Router = Router();
eventsRouter.use(cors({ origin: "*" }));

/**
 * @api {get} /event/ GET /event/
 * @apiName Event
 * @apiGroup Event
 * @apiDescription Get all the publicly-available events
 *
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
 * @apiError (500: Internal Error) {String} InternalError Database operation failed.
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 500 Internal Server Error
 *     {"error": "InternalError"}
 */
eventsRouter.get("/", async (_: Request, res: Response) => {
	const collection: Collection = await DatabaseHelper.getCollection("event", "events");

	try {
		// Get collection from the database, and return it as an array
		const events: EventSchema[] = await collection.find().toArray() as EventSchema[];
		res.status(Constants.SUCCESS).send({ events: events.map(camelcaseEvent) });
	} catch {
		res.status(Constants.INTERNAL_ERROR).send({ error: "InternalError" });
	}
});


export default eventsRouter;
