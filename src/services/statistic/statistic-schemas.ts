import { prop } from "@typegoose/typegoose";

export class EventStatistic {
    @prop({
        required: true,
    })
    eventId: string;
    @prop({
        required: true,
    })
    attendees: number;
}

export class DecisionStatistic {
    @prop({
        required: true,
    })
    accepted: number;
    @prop({
        required: true,
    })
    rejected: number;
    @prop({
        required: true,
    })
    waitlisted: number;
    @prop({
        required: true,
    })
    tbd: number;
}

export class RSVPStatistic {
    @prop({
        required: true,
    })
    accepted: number;
    @prop({
        required: true,
    })
    declined: number;
    @prop({
        required: true,
    })
    pending: number;
}

export class ShopItemStatistic {
    @prop({
        required: true,
    })
    itemId: string;
    @prop({
        required: true,
    })
    purchased: number;
}

export class StatisticLog {
    @prop({ required: true, index: true })
    public timestamp: number;

    @prop({
        required: true,
        type: () => [EventStatistic],
    })
    public events: EventStatistic[];

    @prop({
        required: true,
    })
    public decision: DecisionStatistic;

    @prop({ required: true })
    public rsvp: RSVPStatistic;

    @prop({ required: true, type: () => [ShopItemStatistic] })
    public shopItems: ShopItemStatistic[];
}
