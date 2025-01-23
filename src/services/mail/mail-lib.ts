import Config from "../../common/config";
import axios, { AxiosResponse } from "axios";
import { MailInfo, MailSendResults } from "./mail-schemas";

export function sendMail(mailInfo: MailInfo): Promise<AxiosResponse<MailSendResults>> {
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
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: Config.SPARKPOST_KEY,
        },
        data: data,
    };

    return axios.post<MailSendResults>(Config.SPARKPOST_URL, data, config);
}
