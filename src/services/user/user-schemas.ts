import { prop } from "@typegoose/typegoose";
import { z } from "zod";
import { CreateErrorAndSchema, UserIdSchema } from "../../common/schemas";
import { EventIdSchema } from "../../common/schemas";

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

export class UserFollowing {
    @prop({ required: true })
    public userId: string;

    @prop({
        required: true,
        type: () => String,
    })
    public following: string[];
}

export class UserQR {
    @prop({ required: true })
    public userId: string;

    @prop({ required: true })
    public qrId: string;

    @prop({ required: true })
    public exp: number;
}

export const UserInfoSchema = z
    .object({
        userId: UserIdSchema,
        name: z.string().openapi({ example: "John Doe" }),
        email: z.string().openapi({ example: "john@doe.com" }),
    })
    .openapi("UserInfo", {
        description: "A user's info",
    });

// TODO
export const QRInfoSchema = z
    .object({
        userId: UserIdSchema,
        qrInfo: z.string().openapi({ description: "QR code URI for the user", example: "hackillinois://user?userToken=abcd" }),
    })
    .openapi("QRInfo", {
        description: "A user's QR code",
    });

export const UserFollowingSchema = z
    .object({
        userId: UserIdSchema,
        following: z.array(EventIdSchema),
    })
    .openapi("UserFollowing", {
        description: "A user's events they are following",
    });

export const ScanEventRequestSchema = z
    .object({
        eventId: EventIdSchema,
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

export const [AlreadyCheckedInError, AlreadyCheckedInErrorSchema] = CreateErrorAndSchema({
    error: "AlreadyCheckedIn",
    message: "You're already checked in to this event",
});

export type AlreadyCheckedInError = typeof AlreadyCheckedInError;
