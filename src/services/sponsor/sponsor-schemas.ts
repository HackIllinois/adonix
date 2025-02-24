import { prop } from "@typegoose/typegoose";
import { z } from "zod";
import { CreateErrorAndSchema, UserIdSchema } from "../../common/schemas";

export class Sponsor {
    @prop({ required: true, index: true })
    public userId: string;

    @prop({ required: true })
    public email: string;
}

export const SponsorEmailSchema = z
    .string()
    .email("Requires valid email")
    .openapi("SponsorEmail", { example: "example@sponsor.com" });

export const SponsorSchema = z
    .object({
        userId: UserIdSchema,
        email: SponsorEmailSchema,
    })
    .openapi("Sponsor");

export const CreateSponsorRequestSchema = z
    .object({
        email: SponsorEmailSchema,
    })
    .openapi("CreateSponsorRequest");

export const DeleteSponsorRequestSchema = z
    .object({
        userId: UserIdSchema,
    })
    .openapi("DeleteSponsorRequest");

export const ResumeBookFilterSchema = z
    .object({
        graduations: z.array(z.coerce.number()).optional(),
        majors: z.array(z.string()).optional(),
        degrees: z.array(z.string()).optional(),
    })
    .openapi("ResumeBookFilter");

export const ResumeBookPageQuerySchema = z
    .object({
        page: z.coerce.number().min(1),
    })
    .openapi("ResumeBookPageQuery");

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
