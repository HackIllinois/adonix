import { z } from "zod";

export const BulkEmailEntrySchema = z
    .object({
        destination: z.string(),
        replacementTemplateData: z.optional(z.record(z.unknown())),
    })
    .openapi("BulkEmailEntry");

export const MailInfoSchema = z
    .object({
        templateId: z.string(),
        bulkEmailEntries: z.array(BulkEmailEntrySchema),
        defaultTemplateData: z.optional(z.record(z.unknown())),
    })
    .openapi("MailInfo");

export type BulkEmailEntry = z.infer<typeof BulkEmailEntrySchema>;
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
