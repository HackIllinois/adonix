import { prop } from "@typegoose/typegoose";
import { RouterError } from "../../middleware/error-handler";
import { AttendeeProfile } from "../profile/profile-schemas";
import { UserIdSchema, EventIdSchema } from "../../common/schemas";
import { z } from "zod";
import { CreateErrorAndSchema, SuccessResponseSchema } from "../../common/schemas";

export class StaffShift {
    @prop({ required: true })
    public userId: string;

    @prop({
        required: true,
        type: () => String,
    })
    public shifts: string[];
}

// Format for default staff attendance input
export interface AttendanceFormat {
    eventId: string;
}

export interface EventError {
    statuscode: number;
    name: string;
}

export interface checkInResult {
    success: boolean;
    error?: RouterError;
    profile?: AttendeeProfile;
}

export const StaffAttendanceRequestSchema = z.object({
    eventId: EventIdSchema,
});

export const ScanAttendeeRequestSchema = z
    .object({
        eventId: EventIdSchema,
        attendeeJWT: z.string().openapi({ description: "The scanned QR code token", example: "a35FG==" }),
    })
    .openapi("ScanAttendeeRequest");

export const ScanAttendeeSchema = SuccessResponseSchema.extend({
    userId: UserIdSchema,
    dietaryRestrictions: z.array(z.string()).openapi({ example: ["Vegan", "No Pork"] }),
}).openapi("ScanAttendee");

export const TempEventSchema = z.any();
export const ShiftsSchema = z
    .object({
        shifts: z.array(TempEventSchema),
    })
    .openapi("Shifts");

export const ShiftsAddRequestSchema = z.object({
    userId: UserIdSchema,
    shifts: z.array(EventIdSchema),
});

export const [CodeExpiredError, CodeExpiredErrorSchema] = CreateErrorAndSchema({
    error: "CodeExpired",
    message: "The code for this event has expired",
});
