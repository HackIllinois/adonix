import { Router } from "express";
import { Role } from "../auth/auth-schemas";

import { StatusCode } from "status-code-enum";

import specification, { Tag } from "../../middleware/specification";
import {
    EventFollowersSchema,
    EventNotFoundError,
    EventNotFoundErrorSchema,
    PublicEventsSchema,
    PublicEventSchema,
    EventType,
    EventSchema,
    CreateEventRequestSchema,
    UpdateEventRequestSchema,
    EventMetadataWithIdSchema,
} from "./event-schemas";
import { EventIdSchema, SuccessResponseSchema } from "../../common/schemas";
import { z } from "zod";
import Models from "../../common/models";
import { tryGetAuthenticatedUser } from "../../common/auth";
import { filterEvent, restrictEventsByRoles } from "./event-lib";
import Config from "../../common/config";
import crypto from "crypto";

const eventsRouter = Router();

eventsRouter.get(
    "/followers/:id/",
    specification({
        method: "get",
        path: "/event/followers/{id}/",
        tag: Tag.EVENT,
        role: Role.STAFF,
        summary: "Gets all the followers of an event",
        parameters: z.object({
            id: EventIdSchema,
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The followers",
                schema: EventFollowersSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Couldn't find the event specified",
                schema: EventNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: eventId } = req.params;
        const event = await Models.EventFollowers.findOne({ eventId });
        if (!event) {
            return res.status(StatusCode.ClientErrorNotFound).send(EventNotFoundError);
        }
        return res.status(StatusCode.SuccessOK).send({ eventId, followers: event.followers });
    },
);

eventsRouter.get(
    "/staff/",
    specification({
        method: "get",
        path: "/event/staff/",
        tag: Tag.EVENT,
        role: Role.STAFF,
        summary: "Gets all staff events",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The events",
                schema: PublicEventsSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Couldn't find the event specified",
                schema: EventNotFoundErrorSchema,
            },
        },
    }),
    async (_req, res) => {
        const events = await Models.Event.find({ isStaff: true });
        const filteredEvents = events.map(filterEvent);
        return res.status(StatusCode.SuccessOK).send({ events: filteredEvents });
    },
);

eventsRouter.get(
    "/:id/",
    specification({
        method: "get",
        path: "/event/{id}/",
        tag: Tag.EVENT,
        role: null,
        summary: "Gets details of an event",
        parameters: z.object({
            id: EventIdSchema,
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The event",
                schema: PublicEventSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description:
                    "Couldn't find the event specified.\n" +
                    "This also occurs if the user doesn't have permission to view this event.",
                schema: EventNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: eventId } = req.params;
        const roles = tryGetAuthenticatedUser(req)?.roles || [];

        const event = await Models.Event.findOne({ eventId, ...restrictEventsByRoles(roles) });

        if (!event) {
            return res.status(StatusCode.ClientErrorNotFound).send(EventNotFoundError);
        }

        const filteredEvent = filterEvent(event);
        return res.status(StatusCode.SuccessOK).send(filteredEvent);
    },
);

eventsRouter.get(
    "/",
    specification({
        method: "get",
        path: "/event/",
        tag: Tag.EVENT,
        role: null,
        summary: "Gets all events",
        description:
            "The events returned are filtered based on what the currently authenticated user can access.\n" +
            "For example, if the currently authenticated user is not staff, staff events will not be shown.",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The events",
                schema: PublicEventsSchema,
            },
        },
    }),
    async (req, res) => {
        const roles = tryGetAuthenticatedUser(req)?.roles || [];
        const events = await Models.Event.find({
            eventType: { $ne: EventType.STAFF_SHIFT },
            ...restrictEventsByRoles(roles),
        });

        // filter events to only show public data
        const filteredEvents = events.map(filterEvent);
        return res.status(StatusCode.SuccessOK).send({ events: filteredEvents });
    },
);

eventsRouter.post(
    "/",
    specification({
        method: "post",
        path: "/event/",
        tag: Tag.EVENT,
        role: Role.ADMIN,
        summary: "Create a new event",
        body: CreateEventRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The new event",
                schema: EventSchema,
            },
        },
    }),
    async (req, res) => {
        const createRequest = req.body;
        const eventId = crypto.randomBytes(Config.EVENT_BYTES_GEN).toString("hex");

        // Create the new event and its attendance
        const event = await Models.Event.create({
            ...createRequest,
            eventId,
        });
        await Models.EventAttendance.create({ eventId: eventId, attendees: [] });
        return res.status(StatusCode.SuccessCreated).send(event);
    },
);

eventsRouter.put(
    "/",
    specification({
        method: "put",
        path: "/event/",
        tag: Tag.EVENT,
        role: Role.ADMIN,
        summary: "Update a event",
        body: UpdateEventRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The updated event",
                schema: EventSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Couldn't find the event to update",
                schema: EventNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const event = req.body;
        const eventId = event.eventId;

        const updatedEvent = await Models.Event.findOneAndUpdate({ eventId: eventId }, event, {
            new: true,
        });

        if (!updatedEvent) {
            return res.status(StatusCode.ClientErrorNotFound).send(EventNotFoundError);
        }

        return res.status(StatusCode.SuccessOK).send(updatedEvent);
    },
);

eventsRouter.delete(
    "/:id/",
    specification({
        method: "delete",
        path: "/event/{id}/",
        tag: Tag.EVENT,
        role: Role.ADMIN,
        summary: "Delete a event",
        parameters: z.object({
            id: EventIdSchema,
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Successfully deleted",
                schema: SuccessResponseSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Couldn't find the event to delete",
                schema: EventNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: eventId } = req.params;

        const result = await Models.Event.findOneAndDelete({ eventId: eventId });
        if (!result) {
            return res.status(StatusCode.ClientErrorNotFound).send(EventNotFoundError);
        }

        return res.status(StatusCode.SuccessNoContent).send({ success: true });
    },
);

eventsRouter.get(
    "/metadata/:id/",
    specification({
        method: "get",
        path: "/event/metadata/{id}/",
        tag: Tag.EVENT,
        role: Role.ADMIN,
        summary: "Get metadata of an event",
        parameters: z.object({
            id: EventIdSchema,
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Successfully deleted",
                schema: EventMetadataWithIdSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Couldn't find the event to delete",
                schema: EventNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: eventId } = req.params;
        const event = await Models.Event.findOne({ eventId: eventId });

        if (!event) {
            return res.status(StatusCode.ClientErrorNotFound).send(EventNotFoundError);
        }

        return res.status(StatusCode.SuccessOK).send({ eventId, exp: event.exp });
    },
);

eventsRouter.put(
    "/metadata/",
    specification({
        method: "put",
        path: "/event/metadata/",
        tag: Tag.EVENT,
        role: Role.ADMIN,
        summary: "Set metadata of an event",
        body: EventMetadataWithIdSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The updated event",
                schema: EventSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Couldn't find the event to delete",
                schema: EventNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const metadataUpdateRequest = req.body;
        const eventId = metadataUpdateRequest.eventId;
        const event = await Models.Event.findOneAndUpdate({ eventId }, metadataUpdateRequest, { new: true });

        if (!event) {
            return res.status(StatusCode.ClientErrorNotFound).send(EventNotFoundError);
        }

        return res.status(StatusCode.SuccessOK).send(event);
    },
);

export default eventsRouter;
