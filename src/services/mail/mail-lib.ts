import Config from "../../common/config";
import { SESv2Client, SendBulkEmailCommand } from "@aws-sdk/client-sesv2";
import { MailInfo, MailSendResults } from "./mail-schemas";

let ses: SESv2Client | undefined = undefined;

function getClient(): SESv2Client {
    ses ??= new SESv2Client({ region: Config.SES_REGION });
    return ses;
}

export async function sendMail(mailInfo: MailInfo): Promise<MailSendResults> {
    if (mailInfo.bulkEmailEntries.length === 0) {
        return {
            results: {
                total_accepted_recipients: 0,
                total_rejected_recipients: 0,
                id: "NO_MAIL_SENT_SINCE_NO_RECIPIENTS",
            },
        };
    }

    const awsBulkEntries = mailInfo.bulkEmailEntries.map((entry) => ({
        Destination: {
            ToAddresses: [entry.destination],
        },
        ReplacementEmailContent: entry.replacementTemplateData
            ? {
                  ReplacementTemplate: {
                      ReplacementTemplateData: JSON.stringify(entry.replacementTemplateData),
                  },
              }
            : undefined,
    }));

    const command = new SendBulkEmailCommand({
        FromEmailAddress: Config.SES_FROM_EMAIL,
        DefaultContent: {
            Template: {
                TemplateName: mailInfo.templateId,
                TemplateData: JSON.stringify(mailInfo.defaultTemplateData || {}),
            },
        },
        BulkEmailEntries: awsBulkEntries,
    });

    let response;
    try {
        response = await getClient().send(command);
    } catch (error) {
        console.error("Failed to send bulk email:", error);
        throw new Error("Failed to send mail");
    }

    const acceptedCount = response.BulkEmailEntryResults?.filter((r) => r.Status === "SUCCESS").length || 0;
    const rejectedCount = mailInfo.bulkEmailEntries.length - acceptedCount;

    return {
        results: {
            total_accepted_recipients: acceptedCount,
            total_rejected_recipients: rejectedCount,
            id: response.BulkEmailEntryResults?.[0]?.MessageId || "",
        },
    };
}
