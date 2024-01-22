import Config from "../../config.js";
import axios, { AxiosResponse } from "axios";
import { Response, NextFunction } from "express";
import { StatusCode } from "status-code-enum";
import { RouterError } from "../../middleware/error-handler.js";
import { MailInfoFormat } from "./mail-formats.js";

export async function sendMailWrapper(res: Response, next: NextFunction, mailInfo: MailInfoFormat): Promise<void | Response> {
    try {
        const result = await sendMail(mailInfo.templateId, mailInfo.recipients, mailInfo.scheduleTime);
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

function sendMail(templateId: string, emails: string[], scheduleTime?: string): Promise<AxiosResponse> {
    console.log("in here 2!");
    const options = scheduleTime ? { start_time: scheduleTime } : {};
    const recipients = emails.map((emailAddress: string) => ({ address: `${emailAddress}` }));

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
