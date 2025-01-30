import { prop } from "@typegoose/typegoose";
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

export const StaffAttendanceRequestSchema = z.object({
    eventId: EventIdSchema,
});

export const ScanAttendeeRequestSchema = z
    .object({
        eventId: EventIdSchema,
        attendeeQRCode: z.string().openapi({ description: "The scanned QR code token", example: "ns6Shwu2" }),
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

export const [QRExpiredError, QRExpiredErrorSchema] = CreateErrorAndSchema({
    error: "QRExpired",
    message: "Your QR code has expired",
});
