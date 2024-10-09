import { isEnumOfType, isNumber, isString } from "../../common/formatTools";
import { Role } from "../auth/auth-models";

export interface NotificationSendFormat {
    role?: string;
    eventId?: string;
    staffShift?: string;
    foodWave?: number;

    title: string;
    body: string;
}

/* eslint-disable no-magic-numbers */
export function isValidNotificationSendFormat(obj: NotificationSendFormat): boolean {
    const validCt = (obj.role ? 1 : 0) + (obj.eventId ? 1 : 0) + (obj.foodWave ? 1 : 0) + (obj.staffShift ? 1 : 0);
    if (validCt != 1) {
        return false;
    }

    if (obj.role && !isEnumOfType(obj.role, Role)) {
        return false;
    }

    if (obj.eventId && !isString(obj.eventId)) {
        return false;
    }

    if (obj.foodWave && !isNumber(obj.foodWave)) {
        return false;
    }

    if (obj.staffShift && !isString(obj.staffShift)) {
        return false;
    }

    if (!isString(obj.title)) {
        return false;
    }

    if (!isString(obj.body)) {
        return false;
    }

    return true;
}
