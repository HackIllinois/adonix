import { isString, isArrayOfType } from "../../formatTools.js";

export interface MailInfoFormat {
    templateId: string;
    recipients: string[];
    scheduleTime?: string;
}

export function isValidMailInfo(mailInfo: MailInfoFormat): boolean {
    if (!mailInfo) {
        return false;
    }

    if (!isString(mailInfo.templateId)) {
        return false;
    }

    if (!isArrayOfType(mailInfo.recipients, isString)) {
        return false;
    }

    if (mailInfo.scheduleTime && !isString(mailInfo.scheduleTime)) {
        return false;
    }

    return true;
}
