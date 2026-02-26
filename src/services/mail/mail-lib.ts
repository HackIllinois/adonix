import Config from "../../common/config";
import { SESv2Client, SendEmailCommand, SendBulkEmailCommand, TooManyRequestsException } from "@aws-sdk/client-sesv2";
import { MailBulkSendResult } from "./mail-schemas";
import { setTimeout } from "timers/promises";

let ses: SESv2Client | undefined = undefined;

function getSESClient(): SESv2Client {
    ses ??= new SESv2Client({ region: Config.SES_REGION });
    return ses;
}

function getBackoffDuration(attempt: number): number {
    const duration = Config.MIN_MAIL_BACKOFF_MS * Math.pow(2, attempt);
    return Math.min(duration, Config.MAX_MAIL_BACKOFF_MS);
}

function isThrottlingError(error: unknown): boolean {
    if (error instanceof TooManyRequestsException) {
        return true;
    }

    if (error instanceof Error && error.name === "Throttling") {
        return true;
    }

    return false;
}

export async function sendMail(templateId: string, recipient: string, templateData?: Record<string, unknown>): Promise<string> {
    const command = new SendEmailCommand({
        FromEmailAddress: Config.SES_FROM_EMAIL,
        Destination: {
            ToAddresses: [recipient],
        },
        Content: {
            Template: {
                TemplateName: templateId,
                TemplateData: JSON.stringify(templateData || {}),
            },
        },
    });

    for (let attempt = 0; attempt < Config.MAX_MAIL_SEND_RETRIES; attempt++) {
        try {
            const response = await getSESClient().send(command);
            return response.MessageId || "";
        } catch (error) {
            if (isThrottlingError(error) && attempt < Config.MAX_MAIL_SEND_RETRIES - 1) {
                await setTimeout(getBackoffDuration(attempt));
            } else {
                throw error;
            }
        }
    }

    throw new Error("Max retries exceeded");
}

export async function sendBulkMail(
    templateId: string,
    recipients: Array<{ email: string; data?: Record<string, unknown> }>,
    defaultTemplateData?: Record<string, unknown>,
): Promise<MailBulkSendResult> {
    const errors: string[] = [];
    let successCount = 0;

    for (let i = 0; i < recipients.length; i += Config.SES_BULK_BATCH_SIZE) {
        const batchEnd = i + Config.SES_BULK_BATCH_SIZE;
        const batch = recipients.slice(i, batchEnd);

        const command = new SendBulkEmailCommand({
            FromEmailAddress: Config.SES_FROM_EMAIL,
            DefaultContent: {
                Template: {
                    TemplateName: templateId,
                    TemplateData: JSON.stringify(defaultTemplateData || {}),
                },
            },
            BulkEmailEntries: batch.map(({ email, data }) => ({
                Destination: {
                    ToAddresses: [email],
                },
                ReplacementEmailContent: {
                    ReplacementTemplate: {
                        ReplacementTemplateData: JSON.stringify({ ...defaultTemplateData, ...data }),
                    },
                },
            })),
        });

        for (let attempt = 0; attempt < Config.MAX_MAIL_SEND_RETRIES; attempt++) {
            try {
                const response = await getSESClient().send(command);

                response.BulkEmailEntryResults?.forEach((result, index) => {
                    if (result.Status === "SUCCESS") {
                        successCount++;
                    } else {
                        const email = batch[index]!.email;
                        errors.push(`${email}: ${result.Error ?? "Unknown error"}`);
                    }
                });

                break;
            } catch (error) {
                if (isThrottlingError(error) && attempt < Config.MAX_MAIL_SEND_RETRIES - 1) {
                    await setTimeout(getBackoffDuration(attempt));
                } else {
                    for (const { email } of batch) {
                        const message = error instanceof Error ? error.message : String(error);
                        errors.push(`${email}: ${message}`);
                    }
                    break;
                }
            }
        }
    }

    return {
        success: errors.length === 0,
        successCount,
        failedCount: errors.length,
        errors,
    };
}
