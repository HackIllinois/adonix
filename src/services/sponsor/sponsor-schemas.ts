import { prop } from "@typegoose/typegoose";
import { z } from "zod";
import { CreateErrorAndSchema, UserIdSchema } from "../../common/schemas";
import { RegistrationApplicationSubmitted, RegistrationApplicationSubmittedSchema } from "../registration/registration-schemas";

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

export const RESUME_BOOK_ENTRY_FIELDS = {
    userId: true,
    email: true,
    firstName: true,
    lastName: true,
    school: true,
    education: true,
    major: true,
    graduate: true,
    pro: true,
} satisfies Partial<Record<keyof RegistrationApplicationSubmitted, boolean | undefined>>;
export const ResumeBookEntrySchema = RegistrationApplicationSubmittedSchema.pick(RESUME_BOOK_ENTRY_FIELDS)
    .extend({ title: z.string().optional(), pro: z.boolean().optional() })
    .openapi("ResumeBookEntry");

export const [SponsorNotFoundError, SponsorNotFoundErrorSchema] = CreateErrorAndSchema({
    message: "NotFound",
    error: "Failed to find the sponsor",
});
