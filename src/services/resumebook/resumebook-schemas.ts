import { z } from "zod";

export const ResumeBookFilterCriteriaSchema = z.object({
    graduations: z.array(z.string()).default([]),
    majors: z.array(z.string()).default([]),
    degrees: z.array(z.string()).default([]),
});

export const ResumeBookRequestSchema = z.object({
    userId: z.string().default("google12345"),
    legalName: z.string().default("John Doe"),
    emailAddress: z.string().email(),
    degree: z.string(),
    major: z.string(),
    minor: z.string().optional(), // Allowing empty string but keeping it optional
    gradYear: z.number().int(),
});
