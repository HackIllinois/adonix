import { prop, modelOptions } from "@typegoose/typegoose";
import { GenericEventFormat } from "./event-formats.js";
import { ObjectId } from "mongodb";
import Constants from "../../constants.js";

// Interface for the location of the event
@modelOptions({ schemaOptions: { _id: false } })
export class Location {
    @prop({ required: true })
    public description: string;

    @prop({
        required: true,
        type: () => {
            return String;
        },
    })
    public tags: string[];

    @prop({ required: true })
    public latitude: number;

    @prop({ required: true })
    public longitude: number;
}

// Interface for the actual event
class BaseEvent {
    @prop({ required: true })
    _id: string;

    @prop({ required: true })
    eventId: string;

    @prop({ required: true })
    name: string;

    @prop({ required: true })
    description: string;

    @prop({ required: true })
    startTime: number;

    @prop({ required: true })
    endTime: number;

    @prop({ required: true })
    eventType: string;

    @prop({
        required: true,
        type: () => {
            return Location;
        },
    })
    locations: Location[];

    @prop({ required: true })
    isAsync: boolean;

    constructor(baseEvent: GenericEventFormat, setId: boolean = true) {
        const id: string = baseEvent._id ?? new ObjectId().toHexString();
        if (setId) {
            this._id = id;
            this.eventId = id;
        }
        this.description = baseEvent.description;
        this.name = baseEvent.name;
        this.startTime = baseEvent.startTime;
        this.endTime = baseEvent.endTime;
        this.locations = baseEvent.locations;
        this.isAsync = baseEvent.isAsync;
    }
}

export class EventMetadata {
    @prop({ required: true })
    public _id: string;

    @prop({ required: true })
    public isStaff: boolean;

    @prop({ required: true })
    public exp: number;

    constructor(_id: string, isStaff: boolean, exp: number) {
        this._id = _id;
        this.isStaff = isStaff;
        this.exp = exp;
    }
}

export class PublicEvent extends BaseEvent {
    @prop({ required: true })
    isPrivate: boolean;

    @prop({ required: true })
    displayOnStaffCheckIn: boolean;

    @prop({ required: true })
    sponsor: string;

    @prop({ required: true })
    points: number;

    constructor(baseEvent: GenericEventFormat, setId: boolean = true) {
        super(baseEvent, setId);
        this.eventType = baseEvent.publicEventType ?? "OTHER";
        this.isPrivate = baseEvent.isPrivate ?? false;
        this.displayOnStaffCheckIn = baseEvent.displayOnStaffCheckIn ?? false;
        this.sponsor = baseEvent.sponsor ?? "None";
        this.points = baseEvent.points ?? Constants.DEFAULT_POINT_VALUE;
    }
}

export class StaffEvent extends BaseEvent {
    constructor(baseEvent: GenericEventFormat, setId: boolean = true) {
        super(baseEvent, setId);
        this.eventType = baseEvent.staffEventType ?? "OTHER";
    }
}

// Enum representing the type of the event
// MEAL, SPEAKER, WORKSHOP, MINIEVENT, QNA, or OTHER
export enum PUBLIC_EVENT_TYPE {
    MEAL = "MEAL",
    SPEAKER = "SPEAKER",
    WORKSHOP = "WORKSHOP",
    MINIEVENT = "MINIEVENT",
    QNA = "QNA",
    OTHER = "OTHER",
}

export enum STAFF_EVENT_TYPE {
    MEETING = "MEETING",
    STAFF_SHIFT = "STAFFSHIFT",
    OTHER = "OTHER",
}

export interface FilteredEventView {
    id: string;
    name: string;
    description: string;
    startTime: number;
    endTime: number;
    locations: Location[];
    sponsor: string;
    eventType: PUBLIC_EVENT_TYPE;
    points: number;
    isAsync: boolean;
}

export class StaffAttendingEvent {
    @prop({ required: true })
    _id: string;

    @prop({
        required: true,
        type: () => {
            return String;
        },
    })
    attendees: string[];
}
