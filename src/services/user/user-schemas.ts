import { prop } from "@typegoose/typegoose";
import { z } from "zod";

export class UserInfo {
    @prop({ required: true })
    public userId: string;

    @prop({ required: true })
    public name: string;

    @prop({ required: true })
    public email: string;
}
export class UserAttendance {
    @prop({ required: true })
    public userId: string;

    @prop({
        required: true,
        type: () => String,
    })
    public attendance: string[];
}

export const UserIdSchema = z.string().openapi("UserId", {
    description: "Id of a specific user. Can start with github or google.",
    example: "github1234",
});

export const UserInfoSchema = z
    .object({
        userId: UserIdSchema,
        name: z.string().openapi({ example: "John Doe" }),
        email: z.string().openapi({ example: "john@doe.com" }),
    })
    .openapi("UserInfo", {
        description: "A user's info",
    });

export const QRInfoSchema = z
    .object({
        userId: UserIdSchema,
        qrInfo: z.string().openapi({ description: "QR code URI for the user", example: "hackillinois://user?userToken=abcd" }),
    })
    .openapi("QRInfo", {
        description: "A user's QR code",
    });

export const EventsFollowingSchema = z
    .object({
        userId: UserIdSchema,
        following: z.array(z.string()).openapi({ example: ["event1", "event2", "event3"] }),
    })
    .openapi("EventsFollowing", {
        description: "A user's events they are following",
    });

export const ScanEventRequestSchema = z
    .object({
        eventId: z.string().openapi({ example: "event1" }),
    })
    .openapi("ScanEventRequest");

export const UserNotFoundErrorSchema = z.object({
    error: z.literal("NotFound"),
    message: z.literal("Failed to find user"),
});

export const UserNotFoundError: z.infer<typeof UserNotFoundErrorSchema> = {
    error: "NotFound",
    message: "Failed to find user",
};

export const EventNotFoundErrorSchema = z.object({
    error: z.literal("NotFound"),
    message: z.literal("Could not find event"),
});

export const EventNotFoundError: z.infer<typeof EventNotFoundErrorSchema> = {
    error: "NotFound",
    message: "Could not find event",
};

export type EventNotFoundError = typeof EventNotFoundError;

export const AlreadyCheckedInErrorSchema = z.object({
    error: z.literal("AlreadyCheckedIn"),
    message: z.literal("You're already checked in to this event"),
});

export const AlreadyCheckedInError: z.infer<typeof AlreadyCheckedInErrorSchema> = {
    error: "AlreadyCheckedIn",
    message: "You're already checked in to this event",
};

export type AlreadyCheckedInError = typeof AlreadyCheckedInError;

export const ScanEventSchema = z
    .object({
        success: z.literal(true),
        points: z.number().openapi({
            description: "Points added from checking into the event",
            example: 5,
        }),
    })
    .openapi("ScanEvent");
