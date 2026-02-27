import { prop, Ref } from "@typegoose/typegoose";
import { UserIdSchema, EventIdSchema } from "../../common/schemas";
import { z } from "zod";
import { CreateErrorAndSchema, SuccessResponseSchema } from "../../common/schemas";
import { EventSchema } from "../event/event-schemas";
import { StaffTeam } from "../staff-team/staff-team-schemas";
import { UserInfoSchema } from "../user/user-schemas";

export class StaffInfo {
    @prop({ required: true })
    public firstName: string;

    @prop({ required: true })
    public lastName: string;

    @prop({ required: true })
    public title!: string;

    @prop({ ref: () => StaffTeam, required: false })
    public team?: Ref<StaffTeam>;

    @prop({ required: false })
    public emoji?: string;

    @prop({ required: false })
    public profilePictureUrl?: string;

    @prop({ required: false })
    public quote?: string;

    @prop({ required: true, default: true })
    public isActive!: boolean;

    @prop({ required: true })
    public email: string;

    @prop({ required: true })
    public staffEmail: string;

    @prop({ required: true })
    public school: string;

    @prop({ required: true })
    public major: string;

    @prop({ required: true })
    public education: string;

    @prop({ required: true })
    public graduate: string;

    @prop({ required: true })
    public userId: string;
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

export const ShiftAssignmentSchema = z.object({
    userId: UserIdSchema,
    shifts: z.array(EventIdSchema),
});

export const ShiftAssignmentsSchema = z.object({
    assignments: z.array(ShiftAssignmentSchema),
});

export const ShiftAssignmentUpdateRequestSchema = z.object({
    userId: UserIdSchema,
    shiftId: EventIdSchema,
});

export const ShiftCandidatesSchema = z.object({
    users: z.array(UserInfoSchema),
});

export const StaffInfoRequestSchema = z.object({
    firstName: z.string(),
    lastName: z.string(),
    title: z.string(),
    team: z.string().optional(),
    emoji: z.string().optional(),
    profilePictureUrl: z.string().optional(),
    quote: z.string().optional(),
    isActive: z.boolean().default(true),
    email: z.string(),
    staffEmail: z.string(),
    school: z.string(),
    major: z.string(),
    education: z.string(),
    graduate: z.string(),
});

export const StaffInfoSchema = StaffInfoRequestSchema.extend({
    userId: UserIdSchema,
});

export const [StaffNotFoundError, StaffNotFoundErrorSchema] = CreateErrorAndSchema({
    error: "StaffNotFound",
    message: "The specified staff member was not found",
});

export const [StaffEmailNotFoundError, StaffEmailNotFoundErrorSchema] = CreateErrorAndSchema({
    error: "StaffEmailNotFound",
    message: "No account found for this email, the staff member must sign in with their staff email first",
});

export const [CodeExpiredError, CodeExpiredErrorSchema] = CreateErrorAndSchema({
    error: "CodeExpired",
    message: "The code for this event has expired",
});

export const [QRExpiredError, QRExpiredErrorSchema] = CreateErrorAndSchema({
    error: "QRExpired",
    message: "Your QR code has expired",
});
