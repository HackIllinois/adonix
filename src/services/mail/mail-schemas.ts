import { z } from "zod";

export const MailInfoSchema = z
    .object({
        templateId: z.string(),
        recipient: z.string(),
        templateData: z.optional(z.record(z.unknown())),
    })
    .openapi("MailInfo");

export type MailInfo = z.infer<typeof MailInfoSchema>;

export const MailSendResultsSchema = z
    .object({
        messageId: z.string(),
    })
    .openapi("MailSendResults", {
        example: {
            messageId: "11668787493850529",
        },
    });
export type MailSendResults = z.infer<typeof MailSendResultsSchema>;
