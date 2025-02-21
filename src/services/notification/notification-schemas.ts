import { prop } from "@typegoose/typegoose";
import { z } from "zod";
import { UserIdSchema, EventIdSchema } from "../../common/schemas";
import { Role, RoleSchema } from "../auth/auth-schemas";

export class NotificationMappings {
    @prop({ required: true })
    public userId: string;

    @prop({ required: true })
    public deviceToken: string;
}

export class NotificationMessages {
    @prop({ required: true })
    public sender: string;

    @prop({ required: true })
    public title: string;

    @prop({ required: true })
    public body: string;

    @prop({ required: true, type: () => [String] })
    public sent!: string[];

    @prop({ required: true, type: () => [String] })
    public failed!: string[];
}

export const RegisterDeviceTokenSchema = z
    .object({
        deviceToken: z.string().openapi({
            example: "abcd",
        }),
    })
    .openapi("RegisterDeviceToken");

export const NotificationMessageSchema = z
    .object({
        sender: UserIdSchema,
        title: z.string(),
        body: z.string(),
        sent: z.array(UserIdSchema),
        failed: z.array(UserIdSchema),
    })
    .openapi("NotificationMessage", {
        example: {
            sender: "google1234",
            title: "This is a test notification",
            body: "blame aydan",
            sent: ["github1234", "github1236", "github1235"],
            failed: ["github1237"],
        },
    });

export const NotificationMessagesSchema = z.array(NotificationMessageSchema).openapi("NotificationMessages");

export const NotificationSendRequestSchema = z
    .object({
        title: z.string(),
        body: z.string(),
        role: z.optional(RoleSchema),
        eventId: z.optional(EventIdSchema),
        staffShift: z.optional(EventIdSchema),
        foodWave: z.number().optional(),
        userIds: z.array(UserIdSchema).optional(),
    })
    .openapi("NotificationSendRequest", {
        example: {
            title: "This is a test notification",
            body: "blame aydan",
            role: Role.STAFF,
        },
    });

export const NotificationSendSchema = z
    .object({
        sent: z.array(UserIdSchema),
        failed: z.array(UserIdSchema),
        time_ms: z.number().openapi({ example: 532 }),
    })
    .openapi("NotificationSend");
