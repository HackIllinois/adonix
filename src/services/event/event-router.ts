import cors from "cors";
import crypto from "crypto";
import { Request, Response, Router } from "express";

import Config from "../../config.js";
import { strongJwtVerification, weakJwtVerification } from "../../middleware/verify-jwt.js";

import { hasAdminPerms, hasStaffPerms } from "../auth/auth-lib.js";
import { JwtPayload } from "../auth/auth-models.js";

import { createFilteredEventView } from "./event-lib.js";
import {
    MetadataFormat,
    isValidStaffFormat,
    isValidPublicFormat,
    GenericEventFormat,
    isValidMetadataFormat,
} from "./event-formats.js";
import { FilteredEventView } from "./event-models.js";

import { EventMetadata, PublicEvent, StaffEvent } from "../../database/event-db.js";
import Models from "../../database/models.js";
import { ObjectId } from "mongodb";
import { StatusCode } from "status-code-enum";

const eventsRouter: Router = Router();
eventsRouter.use(cors({ origin: "*" }));

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
 *     "displayOnStaffCheckIn": true
 *   }
 * }
 *
 * @apiUse strongVerifyErrors
 * @apiError (403: Forbidden) {String} Forbidden Not a valid staff token.
 * */
eventsRouter.get("/staff/", strongJwtVerification, async (_: Request, res: Response) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    if (!hasStaffPerms(payload)) {
        return res.status(StatusCode.ClientErrorForbidden).send({ error: "Forbidden" });
    }

    const staffEvents: StaffEvent[] = await Models.StaffEvent.find();
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
 *     "eventType": "WORKSHOP"
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
 *   }
 * }
 *
 * @apiUse strongVerifyErrors
 * @apiError (403: Forbidden) {String} PrivateEvent Access denied for private event.
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 403 Forbidden
 *     {"error": "PrivateEvent"}
 */
eventsRouter.get("/:EVENTID/", weakJwtVerification, async (req: Request, res: Response) => {
    const eventId: string | undefined = req.params.EVENTID;

    const payload: JwtPayload = res.locals.payload as JwtPayload;
    const isStaff: boolean = hasStaffPerms(payload);

    const metadata: EventMetadata | null = await Models.EventMetadata.findOne({ eventId: eventId });

    if (!metadata) {
        return res.status(StatusCode.ClientErrorBadRequest).send({ error: "EventNotFound" });
    }

    if (metadata.isStaff) {
        if (!isStaff) {
            return res.status(StatusCode.ClientErrorForbidden).send({ error: "PrivateEvent" });
        }

        const event: StaffEvent | null = await Models.StaffEvent.findOne({ eventId: eventId });
        if (!event) {
            return res.status(StatusCode.ServerErrorInternal).send({ error: "InternalDatabaseError" });
        }

        return res.status(StatusCode.SuccessOK).send(event);
    } else {
        const event: PublicEvent | null = await Models.PublicEvent.findOne({ eventId: eventId });

        if (!event) {
            return res.status(StatusCode.ServerErrorInternal).send({ error: "InternalDatabaseError" });
        }

        if (isStaff) {
            return res.status(StatusCode.SuccessOK).send(event);
        }

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
 *   "events": [
 *     {
 *       "id": "52fdfc072182654f163f5f0f9a621d72",
 *       "name": "Example Event 10",
 *       "description": "This is a description",
 *       "startTime": 1532202702,
 *       "endTime": 1532212702,
 *       "locations": [
 *         {
 *           "description": "Example Location",
 *           "tags": ["SIEBEL0", "ECEB1"],
 *           "latitude": 40.1138,
 *           "longitude": -88.2249
 *         }
 *       ],
 *       "sponsor": "Example sponsor",
 *       "eventType": "WORKSHOP"
 *     },
 *     // Additional events...
 *   ]
 * }
 *
 * @apiSuccessExample Example Success Response (Staff POV)
 * HTTP/1.1 200 OK
 * {
 *   "events": [
 *     {
 *       "id": "52fdfc072182654f163f5f0f9a621d72",
 *       "name": "Example Event 10",
 *       "description": "This is a description",
 *       "startTime": 1532202702,
 *       "endTime": 1532212702,
 *       "locations": [
 *         {
 *           "description": "Example Location",
 *           "tags": ["SIEBEL0", "ECEB1"],
 *           "latitude": 40.1138,
 *           "longitude": -88.2249
 *         }
 *       ],
 *       "sponsor": "Example sponsor",
 *       "eventType": "WORKSHOP",
 *       "isPrivate": true,
 *       "displayOnStaffCheckIn": true,
 *     },
 *     // Additional events...
 *   ]
 * }
 *
 * @apiUse strongVerifyErrors
 * @apiError (500: Internal Server Error) {String} InternalError An error occurred on the server.
 */
eventsRouter.get("/", weakJwtVerification, async (_: Request, res: Response) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    // Get collection from the database, and return it as an array
    const publicEvents: PublicEvent[] = await Models.PublicEvent.find();

    if (hasStaffPerms(payload)) {
        return res.status(StatusCode.SuccessOK).send({ events: publicEvents });
    } else {
        const filteredEvents: FilteredEventView[] = publicEvents
            .filter((event: PublicEvent) => {
                return !event.isPrivate;
            })
            .map(createFilteredEventView);
        return res.status(StatusCode.SuccessOK).send({ events: filteredEvents });
    }
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
 *   "points": 100
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
 *   "isAsync": true
 * }
 *
 * @apiSuccess (201: Created) {Json} event The created event details.
 * @apiSuccessExample Example Success Response for Public Event
 * HTTP/1.1 201 Created
 * {
 *   "event": {
 *     "id": "52fdfc072182654f163f5f0f9a621d72",
 *     "name": "New Public Event",
 *     "description": "This is a new public event.",
 *     "startTime": 1679485545,
 *     "endTime": 1679489145,
 *     "locations": [
 *       {
 *         "description": "New Location",
 *         "tags": ["TAG1", "TAG2"],
 *         "latitude": 40.1234,
 *         "longitude": -88.5678
 *       }
 *     ],
 *     "sponsor": "Event Sponsor",
 *     "eventType": "WORKSHOP",
 *     "isStaff": false
 *   }
 * }
 *
 * @apiSuccessExample Example Success Response for Staff Event
 * HTTP/1.1 201 Created
 * {
 *   "event": {
 *     "id": "52fdfc072182654f163f5f0f9a621d72",
 *     "name": "New Staff Event",
 *     "description": "This is a new staff event.",
 *     "startTime": 1679485545,
 *     "endTime": 1679489145,
 *     "locations": [
 *       {
 *         "description": "New Location",
 *         "tags": ["TAG1", "TAG2"],
 *         "latitude": 40.1234,
 *         "longitude": -88.5678
 *       }
 *     ],
 *     "sponsor": "Event Sponsor",
 *     "eventType": "MEETING",
 *     "isStaff": true
 *   }
 * }
 *
 * @apiUse strongVerifyErrors
 * @apiError (400: Bad Request) {String} InvalidParams Invalid event parameters provided.
 * @apiError (403: Forbidden) {String} InvalidPermission User does not have admin permissions.
 * @apiError (500: Internal Server Error) {String} InternalError An error occurred on the server.
 */
eventsRouter.post("/", strongJwtVerification, async (req: Request, res: Response) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    // Check if the token has staff permissions
    if (!hasAdminPerms(payload)) {
        return res.status(StatusCode.ClientErrorForbidden).send({ error: "InvalidPermission" });
    }

    // Convert event format into the base event format
    const eventFormat: GenericEventFormat = req.body as GenericEventFormat;

    if (eventFormat.eventId) {
        return res.status(StatusCode.ClientErrorBadRequest).send({ error: "ExtraIdProvided" });
    }

    // Create the ID and process metadata for this event
    const eventId: string = crypto.randomBytes(Config.EVENT_BYTES_GEN).toString("hex");
    const isStaffEvent: boolean = eventFormat.isStaff;
    const metadata: EventMetadata = new EventMetadata(eventId, isStaffEvent, eventFormat.endTime);
    // Populate the new eventFormat object with the needed params
    eventFormat._id = new ObjectId().toString();
    eventFormat.eventId = eventId;

    // Try to upload the events if possible, else throw an error
    let newEvent: PublicEvent | StaffEvent | null;

    if (isStaffEvent) {
        // If ID doesn't exist -> return the invalid parameters
        if (!isValidStaffFormat(eventFormat)) {
            return res.status(StatusCode.ClientErrorBadRequest).send({ error: "InvalidParams" });
        }
        const event: StaffEvent = new StaffEvent(eventFormat);
        newEvent = await Models.StaffEvent.create(event);
    } else {
        if (!isValidPublicFormat(eventFormat)) {
            return res.status(StatusCode.ClientErrorBadRequest).send({ error: "InvalidParams" });
        }
        const event: PublicEvent = new PublicEvent(eventFormat);
        newEvent = await Models.PublicEvent.create(event);
    }
    await Models.EventMetadata.create(metadata);
    return res.status(StatusCode.SuccessCreated).send(newEvent);
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
eventsRouter.delete("/:EVENTID/", strongJwtVerification, async (req: Request, res: Response) => {
    const eventId: string | undefined = req.params.EVENTID;

    // Check if request sender has permission to delete the event
    if (!hasAdminPerms(res.locals.payload as JwtPayload)) {
        return res.status(StatusCode.ClientErrorForbidden).send({ error: "InvalidPermission" });
    }

    // Perform a lazy delete on both databases, and return true if the operation succeeds
    await Models.StaffEvent.findOneAndDelete({ eventId: eventId });
    await Models.PublicEvent.findOneAndDelete({ eventId: eventId });
    await Models.EventMetadata.findOneAndDelete({ eventId: eventId });

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
 *   "isStaff": true,
 *   "exp": 1636103447
 * }
 *
 * @apiUse strongVerifyErrors
 * @apiError (400: Bad Request) {String} EventNotFound Event with the given ID not found.
 * @apiError (403: Forbidden) {String} InvalidPermission User does not have staff permissions.
 * @apiError (500: Internal Server Error) {String} InternalError An error occurred on the server while fetching metadata.
 */
eventsRouter.get("/metadata/:EVENTID", strongJwtVerification, async (req: Request, res: Response) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    if (!hasStaffPerms(payload)) {
        return res.status(StatusCode.ClientErrorForbidden).send({ error: "InvalidPermission" });
    }

    // Check if the request information is valid
    const eventId: string | undefined = req.params.EVENTID;
    const metadata: EventMetadata | null = await Models.EventMetadata.findOne({ eventId: eventId });
    if (!metadata) {
        return res.status(StatusCode.ClientErrorBadRequest).send({ error: "EventNotFound" });
    }
    return res.status(StatusCode.SuccessOK).send(metadata);
});

/**
 * @api {put} /event/metadata/ PUT /event/metadata/
 * @apiGroup Event
 * @apiDescription Update metadata for an event.
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
 *   "isStaff": true,
 *   "exp": 1636103447
 * }
 *
 * @apiUse strongVerifyErrors
 * @apiError (400: Bad Request) {String} InvalidParams Invalid request parameters.
 * @apiError (403: Forbidden) {String} InvalidPermission User does not have admin permissions.
 * @apiError (500: Internal Server Error) {String} InternalError An error occurred on the server while updating metadata.
 */
eventsRouter.put("/metadata/", strongJwtVerification, async (req: Request, res: Response) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    if (!hasAdminPerms(payload)) {
        return res.status(StatusCode.ClientErrorForbidden).send({ error: "InvalidPermission" });
    }

    // Check if the request information is valid
    const metadata: MetadataFormat = req.body as MetadataFormat;
    if (!isValidMetadataFormat(metadata)) {
        return res.status(StatusCode.ClientErrorBadRequest).send({ error: "InvalidParams" });
    }

    // Update the database, and return true if it passes. Else, return false.
    const updatedMetadata: EventMetadata | null = await Models.EventMetadata.findOneAndUpdate(
        { eventId: metadata.eventId },
        metadata,
    );

    if (!metadata) {
        return res.status(StatusCode.ClientErrorBadRequest).send({ error: "EventNotFound" });
    }

    return res.status(StatusCode.SuccessOK).send(updatedMetadata);
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
 * @apiParamExample Example Request (Staff):
 * HTTP/1.1 PUT /event/
 * {
 *   "event": {
 *     "eventId": "52fdfc072182654f163f5f0f9a621d72",
 *     "name": "Example Staff Event",
 *     "description": "This is a staff-only event description",
 *     "startTime": 1636110000,
 *     "endTime": 1636113600,
 *     "locations": [
 *       {
 *         "description": "Staff Location",
 *         "tags": ["Tag1", "Tag2"],
 *         "latitude": 40.1234,
 *         "longitude": -88.5678
 *       }
 *     ],
 *     "eventType": "WORKSHOP",
 *     "isStaff": true,
 *     "isPrivate": false,
 *     "isAsync": true,
 *     "displayOnStaffCheckIn": true
 *   }
 * }
 *
 * @apiParamExample Example Request (Public):
 * HTTP/1.1 PUT /event/
 * {
 *   "event": {
 *     "eventId": "52fdfc072182654f163f5f0f9a621d72",
 *     "name": "Example Public Event",
 *     "description": "This is a public event description",
 *     "startTime": 1636110000,
 *     "endTime": 1636113600,
 *     "locations": [
 *       {
 *         "description": "Public Location",
 *         "tags": ["Tag3", "Tag4"],
 *         "latitude": 41.5678,
 *         "longitude": -87.1234
 *       }
 *     ],
 *     "sponsor": "Public Sponsor",
 *     "eventType": "MEAL",
 *     "isStaff": false,
 *     "isPrivate": true,
 *     "isAsync": true,
 *     "displayOnStaffCheckIn": false
 *   }
 * }
 *
 * @apiSuccess (200: Success) {Json} event The created or updated event object.
 *
 * @apiUse strongVerifyErrors
 * @apiError (403: Forbidden) {String} Forbidden Not a valid staff or admin token.
 * @apiError (400: Bad Request) {String} Bad Request Invalid parameters or event format.
 * @apiError (500: Internal Server Error) {String} InternalError An internal error occurred.
 */
eventsRouter.put("/", strongJwtVerification, async (req: Request, res: Response) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    // Check if the token has elevated permissions
    if (!hasAdminPerms(payload)) {
        return res.status(StatusCode.ClientErrorForbidden).send({ error: "InvalidPermission" });
    }

    // Verify that the input format is valid to create a new event
    const eventFormat: GenericEventFormat = req.body as GenericEventFormat;
    const eventId: string = eventFormat.eventId;

    if (!eventId) {
        return res.status(StatusCode.ClientErrorBadRequest).send({ message: "NoEventId" });
    }

    const metadata: EventMetadata | null = await Models.EventMetadata.findOne({ eventId: eventFormat.eventId });

    if (!metadata) {
        return res.status(StatusCode.ClientErrorBadRequest).send({ message: "EventNotFound" });
    }

    if (metadata.isStaff) {
        if (!isValidStaffFormat(eventFormat)) {
            return res.status(StatusCode.ClientErrorBadRequest).send({ message: "InvalidParams" });
        }

        const event: StaffEvent = new StaffEvent(eventFormat);
        const updatedEvent: StaffEvent | null = await Models.StaffEvent.findOneAndUpdate({ eventId: eventId }, event);
        return res.status(StatusCode.SuccessOK).send(updatedEvent);
    } else {
        if (!isValidPublicFormat(eventFormat)) {
            return res.status(StatusCode.ClientErrorBadRequest).send({ message: "InvalidParams" });
        }

        const event: PublicEvent = new PublicEvent(eventFormat);
        const updatedEvent: PublicEvent | null = await Models.PublicEvent.findOneAndUpdate({ eventId: eventId }, event);
        return res.status(StatusCode.SuccessOK).send(updatedEvent);
    }
});

export default eventsRouter;
