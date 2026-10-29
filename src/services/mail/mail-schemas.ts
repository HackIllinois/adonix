import { z } from "zod";
import { CreateErrorAndSchema } from "../../common/schemas";
import { NewsletterIdSchema } from "../newsletter/newsletter-schemas";
import Config from "../../common/config";

const MailingListNameSchema = NewsletterIdSchema.min(1).max(Config.MAX_STRING_LENGTH);

export const MailSendSelfSchema = z
    .object({
        subject: z.string(),
        body: z.string(),
        newsletterId: MailingListNameSchema.optional(),
    })
    .openapi("MailSendSelf");

export type MailSendSelf = z.infer<typeof MailSendSelfSchema>;

export const MailSendNewsletterSchema = z
    .object({
        subject: z.string(),
        body: z.string(),
        listName: MailingListNameSchema,
    })
    .openapi("MailSendNewsletter");

export const [NewsletterRecipientsInvalidError, NewsletterRecipientsInvalidErrorSchema] = CreateErrorAndSchema({
    error: "NewsletterRecipientsInvalid",
    message: "This newsletter has no valid audience. Check that it is nonempty and all subscriber addresses are valid.",
});

export const MailSendSchema = z
    .object({
        subject: z.string(),
        body: z.string(),
        emails: z.array(z.string().email()),
    })
    .openapi("MailSend");

export type MailSend = z.infer<typeof MailSendSchema>;

export const MailSendAttendeesSchema = z
    .object({
        subject: z.string(),
        body: z.string(),
    })
    .openapi("MailSendAttendees");

export type MailSendAttendees = z.infer<typeof MailSendAttendeesSchema>;

export const MailSendResultSchema = z
    .object({
        success: z.boolean(),
        message: z.string().optional(),
    })
    .openapi("MailSendResult", {
        example: {
            success: true,
        },
    });

export type MailSendResult = z.infer<typeof MailSendResultSchema>;

export const MailBulkSendResultSchema = z
    .object({
        success: z.boolean(),
        successCount: z.number(),
        failedCount: z.number(),
        errors: z.array(z.string()),
    })
    .openapi("MailBulkSendResult", {
        example: {
            success: true,
            successCount: 10,
            failedCount: 0,
            errors: [],
        },
    });

export type MailBulkSendResult = z.infer<typeof MailBulkSendResultSchema>;

export const [UserEmailNotFoundError, UserEmailNotFoundErrorSchema] = CreateErrorAndSchema({
    error: "UserEmailNotFound",
    message: "User email not found",
});
