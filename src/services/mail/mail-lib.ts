import Config from "../../common/config";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { MailBulkSendResult } from "./mail-schemas";

let ses: SESv2Client | undefined = undefined;

function getSESClient(): SESv2Client {
    ses ??= new SESv2Client({ region: Config.SES_REGION });
    return ses;
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

    const response = await getSESClient().send(command);
    return response.MessageId || "";
}

export async function sendBulkMail(
    templateId: string,
    recipients: Array<{ email: string; data?: Record<string, unknown> }>,
    defaultTemplateData?: Record<string, unknown>,
): Promise<MailBulkSendResult> {
    const errors: string[] = [];
    let successCount = 0;

    await Promise.allSettled(
        recipients.map(async ({ email, data }) => {
            try {
                await sendMail(templateId, email, { ...defaultTemplateData, ...data });
                successCount++;
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                errors.push(`${email}: ${message}`);
            }
        }),
    );

    return {
        success: errors.length === 0,
        successCount,
        failedCount: errors.length,
        errors,
    };
}
