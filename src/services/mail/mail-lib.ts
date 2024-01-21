import Config from "../../config.js";
import axios, { AxiosResponse } from "axios";
import { Response, NextFunction } from "express";
import { StatusCode } from "status-code-enum";
import { RouterError } from "../../middleware/error-handler.js";
import { MailInfoFormat } from "./mail-formats.js";

export async function sendMailWrapper(res: Response, next: NextFunction, mailInfo: MailInfoFormat): Promise<void | Response> {
    try {
        const result = await sendMail(mailInfo);
        return res.status(StatusCode.SuccessOK).send(result.data);
    } catch (error) {
        return next(
            new RouterError(StatusCode.ClientErrorBadRequest, "EmailNotSent", {
                status: error.response?.status,
                code: error.code,
            }),
        );
    }
}

export function sendMail(mailInfo: MailInfoFormat): Promise<AxiosResponse> {
    const options = mailInfo.scheduleTime ? { start_time: mailInfo.scheduleTime } : {};
    const recipients = mailInfo.recipients.map((emailAddress: string) => ({ address: `${emailAddress}` }));
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

    return axios.post(Config.SPARKPOST_URL, data, config);
}
