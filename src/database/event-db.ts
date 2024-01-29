import { modelOptions, prop } from "@typegoose/typegoose";

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

    @prop({ required: true })
    public eventType: string;

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
    points?: number;

    @prop({ required: true, default: false })
    isPrivate?: boolean;

    @prop({ required: false })
    displayOnStaffCheckIn?: boolean;

    @prop({ required: true, default: false })
    isPro?: boolean;
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
