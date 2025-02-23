import { prop } from "@typegoose/typegoose";

export class Sponsor {
    @prop({ required: true })
    public userId: string;

    @prop({ required: true })
    public email: string;

    @prop({ required: true })
    public name: string;
}

import { z } from "zod";

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
