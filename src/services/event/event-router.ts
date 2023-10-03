import cors from "cors";
import { Request, Router } from "express";
import { NextFunction, Response } from "express-serve-static-core";
import { ObjectId } from "mongodb";

import Constants from "../../constants.js";
import { strongJwtVerification, weakJwtVerification } from "../../middleware/verify-jwt.js";

import { hasAdminPerms, hasStaffPerms } from "../auth/auth-lib.js";
import { JwtPayload } from "../auth/auth-models.js";

import { createFilteredEventView } from "./event-lib.js";
import { MetadataFormat, isValidStaffFormat, isValidAttendeeFormat, GenericEventFormat, isValidMetadataFormat } from "./event-formats.js";
import { EventMetadata, FilteredEventView, PublicEvent, StaffEvent } from "./event-models.js";
import { PublicEventModel, StaffEventModel, EventMetadataModel } from "./event-db.js";

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
eventsRouter.get("/staff/", strongJwtVerification, async (_: Request, res: Response, next: NextFunction) => {
	const payload: JwtPayload = res.locals.payload as JwtPayload;

	if (!hasStaffPerms(payload)) {
		return res.status(Constants.FORBIDDEN).send({ error: "Forbidden" });
	}

	try {
		const staffEvents: StaffEvent[] = await StaffEventModel.find();
		return res.status(Constants.SUCCESS).send({ events: staffEvents });
	} catch (error) {
		return next(error);
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
eventsRouter.get("/:EVENTID/", weakJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
	const eventId: string | undefined = req.params.EVENTID;

	if (!eventId) {
		return res.redirect("/");
	}

	const payload: JwtPayload = res.locals.payload as JwtPayload;
	try {
		const isStaff: boolean = hasStaffPerms(payload);

		const metadata: EventMetadata | null = await EventMetadataModel.findById(eventId);

		if (!metadata) {
			console.error("no metadata found!");
			return next(new Error("no event found!"));
		}
		
		if (metadata.isStaff) {
			if (!isStaff) {

				return res.status(Constants.FORBIDDEN).send({ error: "PrivateEvent" });
			}

			const event: StaffEvent | null = await StaffEventModel.findById(eventId);
			return res.status(Constants.SUCCESS).send({ event: event });
		} else {
			// Not a private event -> convert to Public event and return
			const event: PublicEvent | null = await PublicEventModel.findById(eventId);
			
			if (!event) {
				console.error("no metadata found!");
				return next(new Error("no event found!"));
			}
	
			const filteredEvent: FilteredEventView = createFilteredEventView(event);
			return res.status(Constants.SUCCESS).send({ event: filteredEvent });
		}
	} catch {
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
eventsRouter.get("/", weakJwtVerification, async (_: Request, res: Response, next: NextFunction) => {
	const payload: JwtPayload = res.locals.payload as JwtPayload;

	try {
		// Get collection from the database, and return it as an array
		const publicEvents: PublicEvent[] = await PublicEventModel.find();

		if (hasStaffPerms(payload)) {
			return res.status(Constants.SUCCESS).send( { events: publicEvents });
		} else {
			const filteredEvents: FilteredEventView[] = publicEvents.map(createFilteredEventView);
			return res.status(Constants.SUCCESS).send({ events: filteredEvents });
		}
	} catch (error) {
		return next(error);
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
eventsRouter.post("/", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
	const payload: JwtPayload = res.locals.payload as JwtPayload;

	// Check if the token has staff permissions
	if (!hasAdminPerms(payload)) {
		return res.status(Constants.FORBIDDEN).send({ error: "InvalidPermission" });
	}

	// Convert event format into the base event format
	const eventFormat: GenericEventFormat = req.body as GenericEventFormat;

	if (eventFormat.eventId) {
		return res.status(Constants.BAD_REQUEST).send({ error: "InvalidParams" });
	}
	
	// Create the ID and process metadata for this event
	const id: string = new ObjectId().toHexString();
	const isStaffEvent: boolean = eventFormat.isStaff;
	const metadata: EventMetadata = new EventMetadata(id, isStaffEvent, eventFormat.endTime);
	eventFormat._id = id;
	eventFormat.eventId = id;

	// If ID doesn't exist -> return the invalid parameters
	if (!isValidStaffFormat(eventFormat) && !isValidAttendeeFormat(eventFormat)) {
		return res.status(Constants.BAD_REQUEST).send({ error: "InvalidParams" });
	}

	// Try to upload the events if possible, else throw an error
	try {
		if (isStaffEvent) {
			console.log("EVENT FORMAT", eventFormat);
			const staffEvent: StaffEvent = new StaffEvent(eventFormat);
			await StaffEventModel.insertMany(staffEvent);
		} else {
			const publicEvent: PublicEvent = new PublicEvent(eventFormat);
			await PublicEventModel.insertMany(publicEvent);
		}
		await EventMetadataModel.insertMany(metadata);
	} catch (error) {
		return next(error);
	}
	
	return res.status(Constants.SUCCESS).send(req.body);
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

	// Perform a lazy delete on both databases, and return true if the operation succeeds
	try {
		await StaffEventModel.findByIdAndDelete(eventId);
		await PublicEventModel.findByIdAndDelete(eventId);
		await EventMetadataModel.findByIdAndDelete(eventId);
		
		return res.status(Constants.SUCCESS).send({ status: "Success" });
	} catch (error) {
		console.error(error);
		return res.status(Constants.INTERNAL_ERROR).send({ error: "InternalError" });
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
 *    "eventId": "52fdfc072182654f163f5f0f9a621d72",
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
eventsRouter.get("/metadata/:EVENTID", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
	const payload: JwtPayload = res.locals.payload as JwtPayload;
	
	if (!hasStaffPerms(payload)) {
		return res.status(Constants.FORBIDDEN).send({ error: "InvalidPermission" });
	}

	// Check if the request information is valid
	const eventId: string | undefined = req.params.EVENTID;
	try {
		const metadata: EventMetadata | null = await EventMetadataModel.findById(eventId);
		if (!metadata) {
			return res.status(Constants.BAD_REQUEST).send({ error: "EventNotFound" });
		}
		return res.status(Constants.SUCCESS).send(metadata);
	} catch (error) {
		return next(error);
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
eventsRouter.put("/metadata/", strongJwtVerification, async (req: Request, res: Response) => {
	const payload: JwtPayload = res.locals.payload as JwtPayload;
	
	if (!hasAdminPerms(payload)) {
		return res.status(Constants.FORBIDDEN).send({ error: "InvalidPermission" });
	}

	// Check if the request information is valid
	const metadata: MetadataFormat = req.body as MetadataFormat;
	if (!isValidMetadataFormat(metadata)) {
		return res.status(Constants.BAD_REQUEST).send({ error: "InvalidParams" });
	}

	// Update the database, and return true if it passes. Else, return false.
	try {
		await EventMetadataModel.findByIdAndUpdate(metadata.eventId, metadata);
		return res.status(Constants.SUCCESS).send(metadata);
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
	const eventFormat: GenericEventFormat = req.body as GenericEventFormat;
	const eventId: string = eventFormat.eventId;

	const metadata: EventMetadata | null = await EventMetadataModel.findById(eventFormat.eventId);

	if (!metadata) {
		return res.status(Constants.BAD_REQUEST).send({ message: "EventNotFound" });
	}

	try {
		if (metadata.isStaff) {
			if (!isValidStaffFormat(eventFormat)) {
				return res.status(Constants.BAD_REQUEST).send({ message: "InvalidParams" });
			}
	
			const event: StaffEvent = new PublicEvent(eventFormat);
			await StaffEventModel.findByIdAndUpdate(eventId, event);
			return res.status(Constants.SUCCESS).send(event);
		} else {
			if (!isValidStaffFormat(eventFormat)) {
				return res.status(Constants.BAD_REQUEST).send({ message: "InvalidParams" });
			}
			const event: PublicEvent = new PublicEvent(eventFormat);
			await StaffEventModel.findByIdAndUpdate(eventId, event);
			return res.status(Constants.SUCCESS).send(event);
		}
	} catch (error) {
		console.error(error);
		return res.status(Constants.INTERNAL_ERROR).send({ error: "InternalError" });
	}
});


// Prototype error handler
eventsRouter.use((err: Error, req: Request, res: Response) => {
	console.error("IN PROTOTYPE ERROR HANDLER!");
	console.warn(req.body);
	console.error(err);
	res.status(Constants.INTERNAL_ERROR);
	res.render( "PROTOerror", { error: err });
	return;
});

export default eventsRouter;
