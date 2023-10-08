import { getModelForClass, modelOptions, mongoose, prop } from "@typegoose/typegoose";
import Constants from "../constants.js";
import { Databases, generateConfig } from "../database.js";
import { ObjectId } from "mongodb";
import { GenericEventFormat } from "../services/event/event-formats.js";

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
    public _id: string;

    @prop({ required: true })
    public eventId: string;

    @prop({ required: true })
    public name: string;

    @prop({ required: true })
    public description: string;

    @prop({ required: true })
    public startTime: number;

    @prop({ required: true })
    public endTime: number;

    @prop({ required: true })
    public eventType: string;

    @prop({
        required: true,
        type: () => {
            return Location;
        },
    })
    public locations: Location[];

    @prop({ required: true })
    public isAsync: boolean;

    constructor(baseEvent: GenericEventFormat, setId: boolean = true) {
        const id: string = new ObjectId().toHexString();
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
    public eventId: string;

    @prop({ required: true })
    public isStaff: boolean;

    @prop({ required: true })
    public exp: number;

    constructor(eventId: string, isStaff: boolean, exp: number) {
        this._id = new ObjectId().toString();
        this.eventId = eventId;
        this.isStaff = isStaff;
        this.exp = exp;
    }
}

export class PublicEvent extends BaseEvent {
    @prop({ required: true })
    public isPrivate: boolean;

    @prop({ required: true })
    public displayOnStaffCheckIn: boolean;

    @prop({ required: true })
    public sponsor: string;

    @prop({ required: true })
    public points: number;

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

export class EventAttendance {
    @prop({ required: true })
    public _id: string;

    @prop({ required: true })
    public eventId: string;

    @prop({
        required: true,
        type: () => {
            return String;
        },
    })
    public attendees: string[];
}

// Collections within the event database
export enum EventDB {
    METADATA = "metadata",
    ATTENDANCE = "attendance",
    STAFF_EVENTS = "staffevents",
    PUBLIC_EVENTS = "publicevents",
}

export const StaffEventModel: mongoose.Model<StaffEvent> = getModelForClass(
    StaffEvent,
    generateConfig(Databases.EVENT_DB, EventDB.STAFF_EVENTS),
);

export const PublicEventModel: mongoose.Model<PublicEvent> = getModelForClass(
    PublicEvent,
    generateConfig(Databases.EVENT_DB, EventDB.PUBLIC_EVENTS),
);

export const EventMetadataModel: mongoose.Model<EventMetadata> = getModelForClass(
    EventMetadata,
    generateConfig(Databases.EVENT_DB, EventDB.METADATA),
);

export const EventAttendanceModel: mongoose.Model<EventAttendance> = getModelForClass(
    EventAttendance,
    generateConfig(Databases.EVENT_DB, EventDB.ATTENDANCE),
);
