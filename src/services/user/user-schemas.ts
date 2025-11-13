import { prop, Ref } from "@typegoose/typegoose";
import { z } from "zod";
import { CreateErrorAndSchema, UserIdSchema } from "../../common/schemas";
import { EventIdSchema } from "../../common/schemas";
import { StaffInfo } from "../staff/staff-schemas";

export class UserInfo {
    @prop({ required: true, index: true })
    public userId: string;

    @prop({ required: true })
    public name: string;

    @prop({ required: true })
    public email: string;

    @prop({ required: false, ref: () => StaffInfo })
    public staffInfo?: Ref<StaffInfo>; //check if user is staff with if (user.staffInfo)
}

export class UserAttendance {
    @prop({ required: true, index: true })
    public userId: string;

    @prop({
        required: true,
        type: () => String,
    })
    public attendance: string[];

    @prop({
        required: false,
        type: () => String,
    })
    public excusedAttendance?: string[];
}

export class UserFollowing {
    @prop({ required: true, index: true })
    public userId: string;

    @prop({
        required: true,
        type: () => String,
    })
    public following: string[];
}

export const UserInfoSchema = z
    .object({
        userId: UserIdSchema,
        name: z.string().openapi({ example: "John Doe" }),
        email: z.string().openapi({ example: "john@doe.com" }),
        staffInfo: z.string().optional().openapi({
            description: "Reference ID to staff info (if user is a staff member)",
            example: "65321af4f7b4b42b0d5a1e7b",
        }),
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
        eventName: z.string(),
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

export const [QRExpiredError, QRExpiredErrorSchema] = CreateErrorAndSchema({
    error: "QRExpired",
    message: "Your QR code has expired",
});

export const [QRInvalidError, QRInvalidErrorSchema] = CreateErrorAndSchema({
    error: "QRInvalid",
    message: "Your QR code is invalid and unable to decrypt",
});

export type AlreadyCheckedInError = typeof AlreadyCheckedInError;
