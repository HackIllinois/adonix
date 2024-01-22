import cors from "cors";
import { Request, Router } from "express";
import { NextFunction, Response } from "express-serve-static-core";

import { strongJwtVerification, weakJwtVerification } from "../../middleware/verify-jwt.js";

import { hasAdminPerms, hasStaffPerms } from "../auth/auth-lib.js";
import { JwtPayload } from "../auth/auth-models.js";

import { MetadataFormat, isValidEvent, isValidMetadataFormat } from "./event-formats.js";
import { createFilteredEventView } from "./event-lib.js";
import { FilteredEventView } from "./event-models.js";

import { StatusCode } from "status-code-enum";
import { Event, EventFollowers } from "../../database/event-db.js";
import Models from "../../database/models.js";

import { RouterError } from "../../middleware/error-handler.js";

import crypto from "crypto";
import Config from "../../config.js";

const eventsRouter: Router = Router();
eventsRouter.use(cors({ origin: "*" }));

/**
 * @api {get} /event/followers/ GET /event/followers/
 * @apiGroup Event
 * @apiDescription Get all the users that are following a particular event. (Staff-Only Endpoint)
 *
 * @apiHeader {String} Authorization User's JWT Token with staff permissions.
 *
 * @apiBody {String} eventId The unique identifier of the event.
 * @apiParamExample {json} Request-Example:
 *     {
 *       "eventId": "testEvent12345"
 *     }
 *
 * @apiSuccess (200: Success) {String} eventId The ID of the event.
 * @apiSuccess (200: Success) {String[]} followers The IDs of the event's followers.
 * @apiSuccessExample {json} Example Success:
 *	{
 		"event": "testEvent12345",
 		"followers": ["provider00001", "provider00002", "provider00003"]
 * 	}
 * @apiUse strongVerifyErrors
 * @apiError (400: Bad Request) {String} InvalidRequest Event with the given ID not found.
 * @apiError (404: Not Found) {String} EventNotFound Event with the given ID not found.
 * @apiError (403: Forbidden) {String} Forbidden User does not have staff permissions.
 */
eventsRouter.get("/followers/", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;
    const eventId: string | undefined = req.body.eventId;

    if (!hasStaffPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "Forbidden"));
    }

    if (!eventId) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "InvalidRequest"));
    }

    const event: EventFollowers | null = await Models.EventFollowers.findOne({ eventId: eventId });

    if (!event) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "EventNotFound"));
    }

    return res.status(StatusCode.SuccessOK).send({ eventId: eventId, followers: event.followers });
});

/**
 * @api {get} /event/staff/ GET /event/staff/
 * @apiGroup Event
 * @apiDescription Get event details, for staff-only events.
 *
 * @apiSuccess (200: Success) {Json} event The event details.
 * @apiSuccessExample Example Success Response
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
 *     "eventType": "WORKSHOP",
 *     "isStaff": true,
 *     "isPrivate": true,
 *     "isAsync": true,
 *     "displayOnStaffCheckIn": true,
 *     "mapImageURL": "someurlmapthingy.com",
 *   }
 * }
 *
 * @apiUse strongVerifyErrors
 * @apiError (403: Forbidden) {String} Forbidden Not a valid staff token.
 * */
eventsRouter.get("/staff/", strongJwtVerification, async (_: Request, res: Response, next: NextFunction) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    if (!hasStaffPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "Forbidden"));
    }

    const staffEvents: Event[] = await Models.Event.find({ isStaff: true });
    return res.status(StatusCode.SuccessOK).send({ events: staffEvents });
});

/**
 * @api {get} /event/:EVENTID/ GET /event/:EVENTID/
 * @apiGroup Event
 * @apiDescription Get public event details by its unique ID.
 *
 * @apiParam {String} EVENTID The unique identifier of the event.
 *
 * @apiSuccess (200: Success) {Json} event The event details.
 * @apiSuccessExample Example Success Response (Public POV)
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
 *     "eventType": "WORKSHOP",
 *     "mapImageURL": "someurlmapthingy.com",
 *   }
 * }
 * @apiSuccessExample Example Success Response (Staff POV)
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
 *     "eventType": "WORKSHOP",
 *     "isPrivate": True,
 *     "displayOnStaffCheckIn": True,
 *     "mapImageURL": "someurlmapthingy.com",
 *   }
 * }
 *
 * @apiUse strongVerifyErrors
 * @apiError (403: Forbidden) {String} PrivateEvent Access denied for private event.
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 403 Forbidden
 *     {"error": "PrivateEvent"}
 */
eventsRouter.get("/:EVENTID/", weakJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const eventId: string | undefined = req.params.EVENTID;

    if (!eventId) {
        return res.redirect("/");
    }

    const payload: JwtPayload = res.locals.payload as JwtPayload;
    const isStaff: boolean = hasStaffPerms(payload);

    const event = await Models.Event.findOne({ eventId: eventId });

    if (!event) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "EventNotFound"));
    }

    if (event.isStaff) {
        if (!isStaff) {
            return next(new RouterError(StatusCode.ClientErrorBadRequest, "PrivateEvent"));
        }
        return res.status(StatusCode.SuccessOK).send(event);
    } else {
        const filteredEvent: FilteredEventView = createFilteredEventView(event);
        return res.status(StatusCode.SuccessOK).send(filteredEvent);
    }
});

/**
 * @api {get} /event/ GET /event/
 * @apiGroup Event
 * @apiDescription Get a list of public events or filtered events based on the user's permissions.
 *
 * @apiSuccess (200: Success) {Json} events The list of events.
 * @apiSuccessExample Example Success Response (Public POV)
 * HTTP/1.1 200 OK
 * {
 *  "events": [
 *      {
 *          "eventId": "ajiwujda18ajd",
 *          "name": "Test Event 1",
 *          "description": "This is Test Event 1. At this event, you can learn about APIs and Databases.",
 *          "startTime": 1708668480,
 *          "endTime": 1708668540,
 *          "locations": [
 *              {
 *                  "description": "Siebel Center for Computer Science",
 *                  "tags": [
 *                      "SIEBEL0"
 *                  ],
 *                  "latitude": 40.1138,
 *                  "longitude": -88.2249
 *              }
 *          ],
 *          "eventType": "WORKSHOP",
 *          "points": 10,
 *          "isAsync": false,
 *          "mapImageURL": "https://raw.githubusercontent.com/HackIllinois/adonix-metadata/main/maps/example.png"
 *      },
 *      {
 *          "eventId": "asdcxwjda18ajd",
 *          "name": "Test Event 2",
 *          "description": "This is Test Event 2. At this event, you can learn about AI/ML.",
 *          "startTime": 1708754880,
 *          "endTime": 1708754940,
 *          "locations": [
 *              {
 *                  "description": "Siebel Center for Computer Science",
 *                  "tags": [
 *                      "SIEBEL0"
 *                  ],
 *                  "latitude": 40.1138,
 *                  "longitude": -88.2249
 *              }
 *          ],
 *          "eventType": "WORKSHOP",
 *          "points": 2000,
 *          "isAsync": false,
 *          "mapImageURL": "https://raw.githubusercontent.com/HackIllinois/adonix-metadata/main/maps/example.png"
 *      }
 *   ]
 * }
 *
 * @apiSuccessExample Example Success Response (Staff POV)
 * HTTP/1.1 200 OK
 * {
 *  "events": [
 *      {
 *          "_id": "65adbbd464f9cea319b3dae4",
 *          "eventId": "ajiwujda18ajd",
 *          "isStaff": false,
 *          "name": "Test Event 1",
 *          "description": "This is Test Event 1. At this event, you can learn about APIs and Databases.",
 *          "startTime": 1708668480,
 *          "endTime": 1708668540,
 *          "eventType": "WORKSHOP",
 *          "locations": [
 *              {
 *                  "description": "Siebel Center for Computer Science",
 *                  "tags": [
 *                      "SIEBEL0"
 *                  ],
 *                  "latitude": 40.1138,
 *                  "longitude": -88.2249
 *              }
 *          ],
 *          "isAsync": false,
 *          "mapImageUrl": "https://raw.githubusercontent.com/HackIllinois/adonix-metadata/main/maps/example.png",
 *          "points": 10,
 *          "isPrivate": false
 *      },
 *      {
 *          "_id": "65adc040face07d159a64519",
 *          "eventId": "asdcxwjda18ajd",
 *          "isStaff": false,
 *          "name": "Test Event 2",
 *          "description": "This is Test Event 2. At this event, you can learn about AI/ML.",
 *          "startTime": 1708754880,
 *          "endTime": 1708754940,
 *          "eventType": "WORKSHOP",
 *          "locations": [
 *              {
 *                  "description": "Siebel Center for Computer Science",
 *                  "tags": [
 *                      "SIEBEL0"
 *                  ],
 *                  "latitude": 40.1138,
 *                  "longitude": -88.2249
 *              }
 *          ],
 *          "isAsync": false,
 *          "mapImageUrl": "https://raw.githubusercontent.com/HackIllinois/adonix-metadata/main/maps/SiebelFloor1.png",
 *          "points": 2000,
 *          "isPrivate": false
 *      }
 *    ]
 * }
 *
 * @apiUse strongVerifyErrors
 * @apiError (500: Internal Server Error) {String} InternalError An error occurred on the server.
 */
eventsRouter.get("/", weakJwtVerification, async (_: Request, res: Response) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    // Get collection from the database, and return it as an array
    const publicEvents: Event[] = await Models.Event.find({ isStaff: false });

    if (hasStaffPerms(payload)) {
        return res.status(StatusCode.SuccessOK).send({ events: publicEvents });
    }

    const filteredEvents: FilteredEventView[] = publicEvents
        .filter((event: Event) => !event.isPrivate)
        .map(createFilteredEventView);
    return res.status(StatusCode.SuccessOK).send({ events: filteredEvents });
});

/**
 * @api {post} /event/ POST /event/
 * @apiGroup Event
 * @apiDescription Create a new event.
 *
 * @apiHeader {String} Authorization User's JWT Token with admin permissions.
 *
 * @apiBody {Json} event The event details to be created.
 * @apiParamExample {Json} Request Body Example for Public Event:
 * {
 *   "name": "New Public Event",
 *   "description": "This is a new public event.",
 *   "startTime": 1679485545,
 *   "endTime": 1679489145,
 *   "locations": [
 *     {
 *       "description": "New Location",
 *       "tags": ["TAG1", "TAG2"],
 *       "latitude": 40.1234,
 *       "longitude": -88.5678
 *     }
 *   ],
 *   "sponsor": "Event Sponsor",
 *   "eventType": "WORKSHOP",
 *   "isStaff": false,
 *   "isPrivate": false,
 *   "displayOnStaffCheckIn": false,
 *   "mapImageURL": "someurlmapthingy.com",
 *   "points": 100,
 *   "exp": 10000
 * }
 *
 * @apiParamExample {Json} Request Body Example for Staff Event:
 * {
 *   "name": "New Staff Event",
 *   "description": "This is a new staff event.",
 *   "startTime": 1679485545,
 *   "endTime": 1679489145,
 *   "locations": [
 *     {
 *       "description": "New Location",
 *       "tags": ["TAG1", "TAG2"],
 *       "latitude": 40.1234,
 *       "longitude": -88.5678
 *     }
 *   ],
 *   "eventType": "MEETING",
 *   "isStaff": true,
 *   "isAsync": true,
 *   "mapImageURL": "someurlmapthingy.com",
 * }
 *
 * @apiSuccess (201: Created) {Json} event The created event details.
 * @apiSuccessExample Example Success Response for Public Event
 * HTTP/1.1 201 Created
 * {
 *     "name": "Wednesday Meeting",
 *     "description": "Weekly General Meeting",
 *     "startTime": 1708841280,
 *     "endTime": 1708841460,
 *     "locations": [
 *         {
 *             "description": "Siebel Center for Computer Science",
 *             "tags": [
 *                 "SIEBEL0"
 *             ],
 *             "latitude": 40.1138,
 *             "longitude": -88.2249
 *         }
 *     ],
 *     "eventType": "MEETING",
 *     "isStaff": true,
 *     "isAsync": false
 * }
 *
 *
 * @apiSuccessExample Example Success Response for Staff Event
 * HTTP/1.1 201 Created
 * {
 *     "eventId": "lxcpno01910ss",
 *     "isStaff": true,
 *     "name": "Wednesday Meeting",
 *     "description": "Weekly General Meeting",
 *     "startTime": 1708841280,
 *     "endTime": 1708841460,
 *     "eventType": "MEETING",
 *     "locations": [
 *         {
 *             "description": "Siebel Center for Computer Science",
 *             "tags": [
 *                 "SIEBEL0"
 *             ],
 *             "latitude": 40.1138,
 *             "longitude": -88.2249
 *         }
 *     ],
 *     "isAsync": false,
 *     "_id": "65adf85316e31ab46559085a"
 * }
 *
 * @apiUse strongVerifyErrors
 * @apiError (400: Bad Request) {String} InvalidParams Invalid event parameters provided.
 * @apiError (403: Forbidden) {String} InvalidPermission User does not have admin permissions.
 * @apiError (500: Internal Server Error) {String} InternalError An error occurred on the server.
 */
eventsRouter.post("/", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    // Check if the token has admin permissions
    if (!hasAdminPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "InvalidPermission"));
    }

    // Convert event format into the base event format
    const eventFormat = req.body as Event;

    if (eventFormat.eventId) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "ExtraIdProvided", { extraEventId: eventFormat.eventId }));
    }

    const eventId: string = crypto.randomBytes(Config.EVENT_BYTES_GEN).toString("hex");
    eventFormat.eventId = eventId;

    if (!isValidEvent(eventFormat)) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "InvalidParams", { data: eventFormat }));
    }

    // Create the new event
    const event: Event = await Models.Event.create(eventFormat);
    return res.status(StatusCode.SuccessCreated).send(event);
});

/**
 * @api {delete} /event/:EVENTID/ DELETE /event/:EVENTID/
 * @apiGroup Event
 * @apiDescription Delete an event by its unique ID.
 *
 * @apiHeader {String} Authorization User's JWT Token with admin permissions.
 *
 * @apiParam {String} EVENTID The unique identifier of the event to be deleted.
 *
 * @apiSuccess (204: No Content) NoContent Event deleted successfully.
 *
 * @apiUse strongVerifyErrors
 * @apiError (400: Bad Request) {String} InvalidParams Invalid event ID provided.
 * @apiError (403: Forbidden) {String} InvalidPermission User does not have admin permissions.
 * @apiError (500: Internal Server Error) {String} InternalError An error occurred on the server while deleting the event.
 */
eventsRouter.delete("/:EVENTID/", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const eventId: string | undefined = req.params.EVENTID;

    // Check if request sender has permission to delete the event
    if (!hasAdminPerms(res.locals.payload as JwtPayload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "InvalidPermission"));
    }

    // Check if eventid field doesn't exist -> if not, returns error
    if (!eventId) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "InvalidParams"));
    }

    // Perform a lazy delete on both databases, and return true if the operation succeeds
    await Models.Event.findOneAndDelete({ eventId: eventId });

    return res.status(StatusCode.SuccessNoContent).send({ status: "Success" });
});

/**
 * @api {get} /event/metadata/:EVENTID/ GET /event/metadata/:EVENTID/
 * @apiGroup Event
 * @apiDescription Get metadata for a specific event by its unique ID.
 *
 * @apiHeader {String} Authorization User's JWT Token with staff permissions.
 *
 * @apiParam {String} EVENTID The unique identifier of the event.
 *
 * @apiSuccess (200: Success) {Json} metadata The metadata of the event.
 * @apiSuccessExample Example Success Response
 * HTTP/1.1 200 OK
 * {
 *   "_id": "52fdfc072182654f163f5f0f9a621d72",
 *   "exp": 1636103447
 * }
 *
 * @apiUse strongVerifyErrors
 * @apiError (404: Not Found) {String} EventNotFound Event with the given ID not found.
 * @apiError (403: Forbidden) {String} InvalidPermission User does not have staff permissions.
 * @apiError (500: Internal Server Error) {String} InternalError An error occurred on the server while fetching metadata.
 */
eventsRouter.get("/metadata/:EVENTID", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    if (!hasStaffPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "InvalidPermission"));
    }

    // Check if the request information is valid
    const eventId: string | undefined = req.params.EVENTID;
    const event: Event | null = await Models.Event.findOne({ eventId: eventId });

    if (!event) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "EventNotFound"));
    }

    return res.status(StatusCode.SuccessOK).send({ eventId: event.eventId, exp: event.exp });
});

/**
 * @api {put} /event/metadata/ PUT /event/metadata/
 * @apiGroup Event
 * @apiDescription Update metadata for an event, i.e. primarily event expiration.
 *
 * @apiHeader {String} Authorization User's JWT Token with admin permissions.
 *
 * @apiBody (Request Body) {String} eventId The unique identifier of the event.
 * @apiBody (Request Body) {Boolean} isStaff Whether the event is staff-only.
 * @apiBody (Request Body) {Number} exp The expiration timestamp for the event.
 *
 * @apiSuccess (200: Success) {Json} metadata The updated metadata of the event.
 * @apiSuccessExample Example Success Response
 * HTTP/1.1 200 OK
 * {
 *   "eventId": "52fdfc072182654f163f5f0f9a621d72",
 *   "exp": 1636103447
 * }
 *
 * @apiUse strongVerifyErrors
 * @apiError (400: Bad Request) {String} InvalidParams Invalid request parameters.
 * @apiError (403: Forbidden) {String} InvalidPermission User does not have admin permissions.
 * @apiError (500: Internal Server Error) {String} InternalError An error occurred on the server while updating metadata.
 * @apiError (404: Not Found) {String} EventNotFound Metadata for the given event was not found
 */
eventsRouter.put("/metadata/", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    if (!hasAdminPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "InvalidPermission"));
    }

    // Check if the request information is valid
    const metadata: MetadataFormat = req.body as MetadataFormat;
    if (!isValidMetadataFormat(metadata)) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "InvalidParams", metadata));
    }

    // Update the database, and return true if it passes. Else, return false.
    const event: Event | null = await Models.Event.findOneAndUpdate({ eventId: metadata.eventId }, metadata);

    if (!event) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "EventNotFound"));
    }

    return res.status(StatusCode.SuccessOK).send(event);
});

/**
 * @api {put} /event/ PUT /event/
 * @apiGroup Event
 * @apiDescription Update a pre-existing event.
 *
 * @apiHeader {String} Authorization Staff or Admin JWT Token.
 *
 * @apiBody {Json} event The event object to create or update.
 *
 * @apiParamExample Example Request (Admin):
 * HTTP/1.1 PUT /event/
 * {
 *     "eventId": "valid10292921",
 *     "isStaff": true,
 *     "name": "Wednesday Meeting !!!EDIT THIS EVENT!!!",
 *     "description": "Weekly General Meeting",
 *     "startTime": 1708841280,
 *     "endTime": 1708841460,
 *     "eventType": "MEETING",
 *     "locations": [
 *         {
 *             "description": "Siebel Center for Computer Science",
 *             "tags": [
 *                 "SIEBEL0"
 *             ],
 *             "latitude": 40.1138,
 *             "longitude": -88.2249
 *         }
 *     ],
 *     "isAsync": false
 * }
 *
 * @apiSuccess (200: Success) {Json} event The created or updated event object.
 *
 * @apiUse strongVerifyErrors
 * @apiError (403: Forbidden) {String} Forbidden Not a valid staff or admin token.
 * @apiError (400: Bad Request) {String} Bad Request Invalid parameters or event format.
 * @apiError (500: Internal Server Error) {String} InternalError An internal error occurred.
 * @apiError (404: Not Found) {String} EventNotFound Metadata for the given event was not found
 */
eventsRouter.put("/", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    // Check if the token has elevated permissions
    if (!hasAdminPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "InvalidPermission"));
    }

    // Verify that the input format is valid to create a new event
    const event: Event = req.body as Event;
    const eventId: string = event.eventId;

    if (!isValidEvent(event)) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "InvalidParams", event));
    }

    const updatedEvent: Event | null = await Models.Event.findOneAndUpdate({ eventId: eventId }, event);

    if (!updatedEvent) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "EventNotFound"));
    }

    return res.status(StatusCode.SuccessOK).send(updatedEvent);
});

export default eventsRouter;
