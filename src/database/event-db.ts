import { modelOptions, prop } from "@typegoose/typegoose";

import Constants from "../constants.js";
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

    constructor(baseEvent: GenericEventFormat) {
        this.eventId = baseEvent.eventId;
        this.name = baseEvent.name;
        this.description = baseEvent.description;
        this.startTime = baseEvent.startTime;
        this.endTime = baseEvent.endTime;
        this.locations = baseEvent.locations;
        this.isAsync = baseEvent.isAsync;
    }
}

export class EventMetadata {
    @prop({ required: true })
    public eventId: string;

    @prop({ required: true })
    public isStaff: boolean;

    @prop({ required: true })
    public exp: number;

    constructor(eventId: string, isStaff: boolean, exp: number) {
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

    @prop()
    public sponsor: string;

    @prop({ required: true })
    public points: number;

    constructor(baseEvent: GenericEventFormat) {
        super(baseEvent);
        this.eventType = baseEvent.publicEventType ?? "OTHER";
        this.isPrivate = baseEvent.isPrivate ?? false;
        this.displayOnStaffCheckIn = baseEvent.displayOnStaffCheckIn ?? false;
        this.sponsor = baseEvent.sponsor ?? "";
        this.points = baseEvent.points ?? Constants.DEFAULT_POINT_VALUE;
    }
}

export class StaffEvent extends BaseEvent {
    constructor(baseEvent: GenericEventFormat) {
        super(baseEvent);
        this.eventType = baseEvent.staffEventType ?? "OTHER";
    }
}

export class EventAttendance {
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
