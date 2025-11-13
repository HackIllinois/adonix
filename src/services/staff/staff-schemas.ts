import { prop, Ref } from "@typegoose/typegoose";
import { UserIdSchema, EventIdSchema } from "../../common/schemas";
import { z } from "zod";
import { CreateErrorAndSchema, SuccessResponseSchema } from "../../common/schemas";
import { EventSchema } from "../event/event-schemas";
import { Team } from "../team/team-schemas";
export class StaffInfo {
    @prop({ required: true })
    public name: string;

    @prop({ required: true })
    public title!: string;

    @prop({ ref: () => Team, required: false })
    public team?: Ref<Team>;

    @prop({ required: false })
    public emoji?: string;

    @prop({ required: false })
    public profilePictureUrl?: string;

    @prop({ required: false })
    public quote?: string;

    @prop({ required: true, default: true })
    public isActive!: boolean;
}

export class StaffShift {
    @prop({ required: true, index: true })
    public userId: string;

    @prop({
        required: true,
        type: () => String,
    })
    public shifts: string[];
}

export const StaffAttendanceRequestSchema = z.object({
    eventId: EventIdSchema,
});

export const ScanAttendeeRequestSchema = z
    .object({
        eventId: EventIdSchema,
        attendeeQRCode: z
            .string()
            .openapi({ description: "The scanned QR code token, not the hackillinois:// uri", example: "ns6Shwu2" }),
    })
    .openapi("ScanAttendeeRequest");

export const ScanAttendeeSchema = SuccessResponseSchema.extend({
    userId: UserIdSchema,
    eventName: z.string(),
    dietaryRestrictions: z.array(z.string()).openapi({ example: ["Vegan", "No Pork"] }),
}).openapi("ScanAttendee");

export const ShiftsSchema = z
    .object({
        shifts: z.array(EventSchema),
    })
    .openapi("Shifts");

export const ShiftsAddRequestSchema = z.object({
    userId: UserIdSchema,
    shifts: z.array(EventIdSchema),
});

export const StaffInfoSchema = z.object({
    name: z.string(),
    title: z.string(),
    team: z.string().optional(),
    emoji: z.string().optional(),
    profilePictureUrl: z.string().optional(),
    quote: z.string().optional(),
    isActive: z.boolean().default(true),
});

export const StaffListParamSchema = z.object({
    active: z.boolean().optional(),
    team: z.string().optional(),
});

export const StaffListSchema = z.object({
    staffList: z.array(StaffInfoSchema),
});

export const [StaffNotFoundError, StaffNotFoundErrorSchema] = CreateErrorAndSchema({
    error: "StaffNotFound",
    message: "The specified staff member was not found",
});

export const [CodeExpiredError, CodeExpiredErrorSchema] = CreateErrorAndSchema({
    error: "CodeExpired",
    message: "The code for this event has expired",
});

export const [QRExpiredError, QRExpiredErrorSchema] = CreateErrorAndSchema({
    error: "QRExpired",
    message: "Your QR code has expired",
});
