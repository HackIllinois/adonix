import { z } from "zod";

export const MailInfoSchema = z
    .object({
        templateId: z.string(),
        recipients: z.array(z.string()),
        scheduleTime: z.optional(z.string()),
        subs: z.optional(z.record(z.unknown())),
    })
    .openapi("MailInfo");

export type MailInfo = z.infer<typeof MailInfoSchema>;

export const MailSendResultsSchema = z
    .object({
        results: z.object({
            total_rejected_recipients: z.number(),
            total_accepted_recipients: z.number(),
            id: z.string(),
        }),
    })
    .openapi("MailSendResults", {
        example: {
            results: {
                total_rejected_recipients: 0,
                total_accepted_recipients: 1,
                id: "11668787493850529",
            },
        },
    });
export type MailSendResults = z.infer<typeof MailSendResultsSchema>;
