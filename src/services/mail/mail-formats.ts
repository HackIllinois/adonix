import { isString, isArrayOfType } from "../../formatTools.js";

export interface MailInfoFormat {
    templateId: string;
    recipients: string[];
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
    return true;
}
