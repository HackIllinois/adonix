import { prop } from "@typegoose/typegoose";
import { z } from "zod";
import { UserIdSchema } from "../user/user-schemas";
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

export const NotificationMessageSchema = z.object({
    sender: UserIdSchema,
    title: z.string(),
    body: z.string(),
    sent: z.array(UserIdSchema),
    failed: z.array(UserIdSchema),
});

export const NotificationsSchema = z.array(NotificationMessageSchema).openapi("Notifications");

export const NotificationSendRequestSchema = z
    .object({
        title: z.string(),
        body: z.string(),
        role: z.optional(RoleSchema),
        eventId: z.string().optional().openapi({ example: "event1" }),
        staffShift: z.string().optional().openapi({ example: "event1" }),
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
