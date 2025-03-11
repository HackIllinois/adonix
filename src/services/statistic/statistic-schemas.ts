import { prop } from "@typegoose/typegoose";
import { z } from "zod";
import { EventIdSchema } from "../../common/schemas";
import { ShopItemIdSchema } from "../shop/shop-schemas";
import Config from "../../common/config";

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

export const EventStatisticSchema = z
    .object({
        eventId: EventIdSchema,
        attendees: z.number(),
    })
    .openapi("EventStatistic");

export const DecisionStatisticSchema = z
    .object({
        accepted: z.number(),
        rejected: z.number(),
        waitlisted: z.number(),
        tbd: z.number(),
    })
    .openapi("DecisionStatistic");

export const RSVPStatisticSchema = z
    .object({
        accepted: z.number(),
        declined: z.number(),
        pending: z.number(),
    })
    .openapi("RSVPStatistic");

export const ShopItemStatisticSchema = z
    .object({
        itemId: ShopItemIdSchema,
        purchased: z.number(),
    })
    .openapi("ShopItemStatistic");

export const StatisticLogSchema = z
    .object({
        timestamp: z.number(),
        events: z.array(EventStatisticSchema),
        decision: DecisionStatisticSchema,
        rsvp: RSVPStatisticSchema,
        shopItems: z.array(ShopItemStatisticSchema),
    })
    .openapi("StatisticLog");

export const StatisticLogsSchema = z.array(StatisticLogSchema).openapi("StatisticLogs");

export const StatisticLogFilterLimitSchema = z.coerce
    .number()
    .min(1)
    .max(Config.STATISTIC_LOG_FILTER_LIMIT)
    .optional()
    .openapi("StatisticLogFilterLimitSchema", {
        example: 5,
        description: `The number of items to return.\n Must be [1, ${Config.STATISTIC_LOG_FILTER_LIMIT}], inclusive.`,
    });

export const StatisticLoggingStatusSchema = z
    .object({
        enabled: z.boolean(),
    })
    .openapi("StatisticLoggingStatus");

export const StatisticLogFilterSchema = z
    .object({
        before: z.coerce.number().optional(),
        after: z.coerce.number().optional(),
        limit: StatisticLogFilterLimitSchema,
    })
    .openapi("StatisticLogFilter");
