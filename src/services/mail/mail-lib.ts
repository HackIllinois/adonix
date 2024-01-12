import Config from "../../config.js";
import axios, { AxiosResponse } from "axios";

export function sendMail(templateId: string, emails: string[], scheduleTime?: string): Promise<AxiosResponse> {
    const options = scheduleTime ? { start_time: scheduleTime } : {};
    const recipients = emails.map((emailAddress: string) => {
        return { address: `${emailAddress}` };
    });

    const data = {
        options: options,
        recipients: recipients,
        content: {
            template_id: templateId,
        },
    };

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

    return axios.post(Config.SPARKPOST_URL, data, config);
}
