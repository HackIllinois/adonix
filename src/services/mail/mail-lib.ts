import Config from "../../common/config";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { BulkMailInfo, MailInfo, MailSendResults } from "./mail-schemas";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

let ses: SESv2Client | undefined = undefined;
let sqs: SQSClient | undefined = undefined;

function getSESClient(): SESv2Client {
    ses ??= new SESv2Client({ region: Config.SES_REGION });
    return ses;
}

function getSQSClient(): SQSClient {
    sqs ??= new SQSClient({ region: Config.SQS_REGION });
    return sqs;
}

export async function sendMail(mailInfo: MailInfo): Promise<MailSendResults> {
    const command = new SendEmailCommand({
        FromEmailAddress: Config.SES_FROM_EMAIL,
        Destination: {
            ToAddresses: [mailInfo.recipient],
        },
        Content: {
            Template: {
                TemplateName: mailInfo.templateId,
                TemplateData: JSON.stringify(mailInfo.templateData || {}),
            },
        },
    });

    let response;
    try {
        response = await getSESClient().send(command);
    } catch (error) {
        console.error("Failed to send email:", error);
        throw new Error("Failed to send mail");
    }

    return {
        messageId: response.MessageId || "",
    };
}

export async function sendBulkMail(bulkMailInfo: BulkMailInfo): Promise<void> {
    const command = new SendMessageCommand({
        QueueUrl: Config.EMAIL_QUEUE_URL,
        MessageBody: JSON.stringify(bulkMailInfo),
    });

    await getSQSClient().send(command);
}
