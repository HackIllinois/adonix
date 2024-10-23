import { prop } from "@typegoose/typegoose";
import { z } from "zod";
import { CreateErrorAndSchema, UserIdSchema } from "../../common/schemas";

export class MentorOfficeHours {
    @prop({ required: true })
    public mentorId: string;

    @prop({ required: true })
    public mentorName: string;

    @prop({
        required: true,
        type: () => String,
    })
    public attendees: string[];
}

export const MentorIdSchema = z.string().openapi("MentorId", { example: "a1f25" });

export const MentorCreateOfficeHoursRequest = z
    .object({
        mentorName: z.string().openapi({ example: "Bob the Mentor" }),
    })
    .openapi("MentorCreateOfficeHours");

export const MentorAttendanceRequestSchema = z
    .object({
        mentorId: MentorIdSchema,
    })
    .openapi("MentorAttendanceRequest");

export const MentorAttendanceSchema = z.object({
    points: z.number().openapi({
        example: 5,
        description: "The points rewarded for checking in",
    }),
});

export const MentorOfficeHoursSchema = MentorCreateOfficeHoursRequest.extend({
    mentorId: MentorIdSchema,
    attendees: z.array(UserIdSchema),
}).openapi("MentorOfficeHours");

export const [MentorNotFoundError, MentorNotFoundErrorSchema] = CreateErrorAndSchema({
    error: "NotFound",
    message: "Failed to find mentor",
});
