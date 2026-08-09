import { prop } from "@typegoose/typegoose";
import { z } from "zod";
import { CreateErrorAndSchema } from "../../common/schemas";

export class JobPosting {
    @prop({ required: true })
    public companyName: string;

    @prop({ required: true })
    public logoUrl: string;

    @prop({ required: true })
    public jobTitle: string;

    @prop({ required: true })
    public jobDescription: string;

    @prop({ required: true })
    public applicationUrl: string;
}

export const JobPostingMongoIdSchema = z
    .string()
    .regex(/^[a-fA-F0-9]{24}$/)
    .openapi("JobPostingMongoId", { example: "65f0d1d7f6201f6a63dbf53e" });

const RequiredTextSchema = z.string().trim().min(1);
const UrlSchema = z.string().url();

export const JobPostingCreateRequestSchema = z
    .object({
        companyName: RequiredTextSchema.openapi({ example: "Example Corp" }),
        logoUrl: UrlSchema.openapi({ example: "https://example.com/logo.png" }),
        jobTitle: RequiredTextSchema.openapi({ example: "Software Engineer Intern" }),
        jobDescription: RequiredTextSchema.openapi({ example: "Build products with our engineering team." }),
        applicationUrl: UrlSchema.openapi({ example: "https://example.com/careers/software-engineer-intern" }),
    })
    .openapi("JobPostingCreateRequest");

export const JobPostingSchema = JobPostingCreateRequestSchema.extend({
    _id: JobPostingMongoIdSchema,
}).openapi("JobPosting");

export const [JobPostingNotFoundError, JobPostingNotFoundErrorSchema] = CreateErrorAndSchema({
    error: "NotFound",
    message: "Failed to find job posting",
});
