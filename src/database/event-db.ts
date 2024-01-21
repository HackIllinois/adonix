import { modelOptions, prop } from "@typegoose/typegoose";

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

    @prop({ required: true })
    public eventType: string;

    @prop({ required: true })
    public exp?: number;

    @prop({
        required: true,
        type: () => {
            return Location;
        },
    })
    public locations: Location[];

    @prop({ required: true })
    public isAsync: boolean;

    @prop({ required: false })
    public mapImageUrl?: string;

    @prop({ required: false })
    sponsor?: string;

    @prop({ required: false })
    points?: number;

    @prop({ required: false })
    isPrivate?: boolean;

    @prop({ required: false })
    displayOnStaffCheckIn?: boolean;
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

export class EventFollowers {
    @prop({ required: true })
    public eventId: string;

    @prop({
        required: true,
        type: () => {
            return String;
        },
    })
    public followers: string[];
}
