import { prop } from "@typegoose/typegoose";
import { z } from "zod";
import { CreateErrorAndSchema, UserIdSchema } from "../../common/schemas";

export class Sponsor {
    @prop({ required: true })
    public userId: string;

    @prop({ required: true })
    public email: string;
}

export const SponsorEmailSchema = z
    .string()
    .email("Requires valid email")
    .openapi("SponsorEmail", { example: "example@sponsor.com" });

export const SponsorSchema = z.object({
    userId: UserIdSchema,
    email: SponsorEmailSchema,
});

export const CreateSponsorRequestSchema = z.object({
    email: SponsorEmailSchema,
});

export const DeleteSponsorRequestSchema = z.object({
    userId: UserIdSchema,
});

export const ResumeBookFilterSchema = z
    .object({
        graduations: z.array(z.string()).default([]),
        majors: z.array(z.string()).default([]),
        degrees: z.array(z.string()).default([]),
    })
    .openapi("ResumeBookFilter");

export const ResumeBookEntrySchema = z
    .object({
        userId: z.string().default("google12345"),
        legalName: z.string().default("John Doe"),
        emailAddress: z.string().email(),
        degree: z.string(),
        major: z.string(),
        minor: z.string().optional(), // Allowing empty string but keeping it optional
        gradYear: z.number().int(),
    })
    .openapi("ResumeBookEntry");

export const [SponsorNotFoundError, SponsorNotFoundErrorSchema] = CreateErrorAndSchema({
    message: "NotFound",
    error: "Failed to find the sponsor",
});
