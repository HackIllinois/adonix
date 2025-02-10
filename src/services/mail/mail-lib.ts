import Config from "../../common/config";
import axios, { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { MailInfo, MailSendResults } from "./mail-schemas";

const HEADERS = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: Config.SPARKPOST_KEY,
};

export function sendMail(mailInfo: MailInfo): Promise<AxiosResponse<MailSendResults>> {
    // Sending mail with no recipients causes an error, so don't send if none
    if (mailInfo.recipients.length == 0) {
        return Promise.resolve({
            data: {
                results: {
                    total_accepted_recipients: 0,
                    total_rejected_recipients: 0,
                    id: "NO_MAIL_SENT_SINCE_NO_RECIPIENTS",
                },
            },
            status: 200,
            statusText: "OK",
            config: {} as InternalAxiosRequestConfig,
            headers: HEADERS,
        } satisfies AxiosResponse<MailSendResults>);
    }
    const options = mailInfo.scheduleTime ? { start_time: mailInfo.scheduleTime } : {};
    const recipients = mailInfo.recipients.map((emailAddress: string, i) => ({
        address: `${emailAddress}`,
        substitution_data: mailInfo.recipientSubs?.[i],
    }));
    const substitution_data = mailInfo.subs;

    const data = {
        options,
        recipients,
        content: {
            template_id: mailInfo.templateId,
        },
        substitution_data,
    };

    console.log(data);

    const config = {
        method: "post",
        maxBodyLength: Infinity,
        headers: HEADERS,
        data: data,
    };

    return axios.post<MailSendResults>(Config.SPARKPOST_URL, data, config).catch((error) => {
        if (error.response) {
            console.error(error.response.status, error.response.data);
        } else if (error.request) {
            console.error(error.request);
        } else {
            console.error(error.message);
        }
        throw new Error("Failed to send mail");
    });
}
