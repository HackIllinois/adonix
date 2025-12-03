import Config from "../../common/config";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { MailInfo, MailSendResults } from "./mail-schemas";

let ses: SESv2Client | undefined = undefined;

function getClient(): SESv2Client {
    ses ??= new SESv2Client({ region: Config.SES_REGION });
    return ses;
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
        response = await getClient().send(command);
    } catch (error) {
        console.error("Failed to send email:", error);
        throw new Error("Failed to send mail");
    }

    return {
        messageId: response.MessageId || "",
    };
}
