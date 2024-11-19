import { modelOptions, prop } from "@typegoose/typegoose";
import { CreateErrorAndSchema, EventIdSchema } from "../../common/schemas";
import { z } from "zod";
import { UserIdSchema } from "../../common/schemas";

export enum EventType {
    MEAL = "MEAL",
    SPEAKER = "SPEAKER",
    WORKSHOP = "WORKSHOP",
    MINIEVENT = "MINIEVENT",
    QNA = "QNA",
    MEETING = "MEETING",
    STAFF_SHIFT = "STAFFSHIFT",
    OTHER = "OTHER",
}
export const EventTypeSchema = z.nativeEnum(EventType);

// Interface for the location of the event
@modelOptions({ schemaOptions: { _id: false } })
export class Location {
    @prop({ required: true })
    public description: string;

    @prop({
        required: true,
        type: () => String,
    })
    public tags: string[];

    @prop({ required: true })
    public latitude: number;

    @prop({ required: true })
    public longitude: number;
}

// Interface for the actual event
export class Event {
    @prop({ required: true })
    public eventId: string;

    @prop({ required: true })
    public isStaff: boolean;

    @prop({ required: true })
    public name: string;

    @prop({ required: true })
    public description: string;

    @prop({ required: true })
    public startTime: number;

    @prop({ required: true })
    public endTime: number;

    @prop({ required: true, enum: EventType })
    public eventType: EventType;

    @prop({ required: false })
    public exp?: number;

    @prop({
        required: true,
        type: () => Location,
    })
    public locations: Location[];

    @prop({ required: true })
    public isAsync: boolean;

    @prop({ required: false })
    public mapImageUrl?: string;

    @prop({ required: false })
    sponsor?: string;

    @prop({ default: 0 })
    points: number;

    @prop({ required: true, default: false })
    isPrivate: boolean;

    @prop({ required: false })
    displayOnStaffCheckIn?: boolean;

    @prop({ default: false })
    isPro: boolean;
}

export class EventAttendance {
    @prop({ required: true })
    public eventId: string;

    @prop({
        required: true,
        type: () => String,
    })
    public attendees: string[];
}

export class EventFollowers {
    @prop({ required: true })
    public eventId: string;

    @prop({
        required: true,
        type: () => String,
    })
    public followers: string[];
}

export const LocationSchema = z
    .object({
        description: z.string(),
        tags: z.array(z.string()),
        latitude: z.number(),
        longitude: z.number(),
    })
    .openapi("Location");

export const EventSchema = z
    .object({
        eventId: EventIdSchema,
        isStaff: z.boolean(),
        name: z.string(),
        description: z.string(),
        startTime: z.number().min(0),
        endTime: z.number().min(0),
        eventType: EventTypeSchema,
        locations: z.array(LocationSchema),
        isAsync: z.boolean(),
        mapImageUrl: z.string().optional(),
        sponsor: z.string().optional(),
        points: z.number().min(0),
        isPrivate: z.boolean(),
        displayOnStaffCheckIn: z.boolean().optional(),
        isPro: z.boolean(),
        exp: z.number().optional(),
    })
    .openapi("PublicEvent", {
        example: {
            eventId: "52fdfc072182654f163f5f0f9a621d72",
            name: "Awesome Event",
            description: "A really cool event",
            startTime: 1532202702,
            endTime: 1532212702,
            locations: [
                {
                    description: "Siebel Center for CS",
                    tags: ["SIEBEL"],
                    latitude: 40.1138,
                    longitude: -88.2249,
                },
            ],
            sponsor: "AwesomeSocks",
            eventType: EventType.WORKSHOP,
            points: 10,
            isStaff: false,
            isPrivate: false,
            isAsync: false,
            isPro: false,
            displayOnStaffCheckIn: true,
            mapImageUrl: "example.com/image.png",
            exp: 12393928829,
        },
    });

export const CreateEventRequestSchema = EventSchema.omit({ eventId: true }).openapi("CreateEventRequest", {
    example: {
        name: "Awesome Event",
        description: "A really cool event",
        startTime: 1532202702,
        endTime: 1532212702,
        locations: [
            {
                description: "Siebel Center for CS",
                tags: ["SIEBEL"],
                latitude: 40.1138,
                longitude: -88.2249,
            },
        ],
        sponsor: "AwesomeSocks",
        eventType: EventType.WORKSHOP,
        points: 10,
        isStaff: false,
        isPrivate: false,
        isAsync: false,
        isPro: false,
        displayOnStaffCheckIn: true,
        mapImageUrl: "example.com/image.png",
    },
});

export const UpdateEventRequestSchema = EventSchema.omit({ eventId: true })
    .partial()
    .merge(EventSchema.pick({ eventId: true }))
    .openapi("UpdateEventRequest", {
        example: {
            eventId: "event1",
            name: "New Name",
        },
    });

export const EventFollowersSchema = z
    .object({
        eventId: EventIdSchema,
        followers: z.array(UserIdSchema),
    })
    .openapi("EventFollowers");

export const EventsSchema = z
    .object({
        events: z.array(EventSchema),
    })
    .openapi("Events");

export const [EventNotFoundError, EventNotFoundErrorSchema] = CreateErrorAndSchema({
    error: "NotFound",
    message: "Could not find event",
});

export type EventNotFoundError = typeof EventNotFoundError;
