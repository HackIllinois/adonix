import { prop } from "@typegoose/typegoose";
import { z } from "zod";
import { CreateErrorAndSchema } from "../../common/schemas";

export class MentorOfficeHours {
    @prop({ required: true })
    public mentorId: string;

    @prop({ required: true })
    public mentorName: string;

    @prop({ required: true })
    public location: string;

    @prop({ required: true })
    public startTime: number;

    @prop({ required: true })
    public endTime: number;

    @prop({
        required: false,
        type: () => String,
    })
    public attendees?: string[];
}

export const MentorIdSchema = z.string().openapi("MentorId", { example: "a1f25" });

export const MentorCreateOfficeHoursRequest = z
    .object({
        mentorName: z.string().openapi({ example: "Bob the Mentor" }),
        location: z.string().openapi({ example: "Siebel 2407" }),
        startTime: z.number().openapi({ example: 1707235200000, description: "Unix timestamp" }),
        endTime: z.number().openapi({ example: 1707238800000, description: "Unix timestamp" }),
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
}).openapi("MentorOfficeHours");

export const [MentorNotFoundError, MentorNotFoundErrorSchema] = CreateErrorAndSchema({
    error: "NotFound",
    message: "Failed to find mentor",
});
