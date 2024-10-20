import { prop } from "@typegoose/typegoose";
import { z } from "zod";
import { CreateErrorAndSchema } from "../../common/schemas";

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

export const ScanEventSchema = z
    .object({
        success: z.literal(true),
        points: z.number().openapi({
            description: "Points added from checking into the event",
            example: 5,
        }),
    })
    .openapi("ScanEvent");

export const [UserNotFoundError, UserNotFoundErrorSchema] = CreateErrorAndSchema({
    error: "NotFound",
    message: "Failed to find user",
});

export const [EventNotFoundError, EventNotFoundErrorSchema] = CreateErrorAndSchema({
    error: "NotFound",
    message: "Could not find event",
});

export type EventNotFoundError = typeof EventNotFoundError;

export const [AlreadyCheckedInError, AlreadyCheckedInErrorSchema] = CreateErrorAndSchema({
    error: "AlreadyCheckedIn",
    message: "You're already checked in to this event",
});

export type AlreadyCheckedInError = typeof AlreadyCheckedInError;
