import Config from "../../common/config";
import Models from "../../common/models";
import { RegistrationApplication } from "./registration-schemas";

export function getApplication(userId: string): Promise<RegistrationApplication | null> {
    return Models.RegistrationApplication.findOne({ userId: userId });
}

export function isRegistrationAlive(): boolean {
    const currentDateTime = new Date().getTime();

    return currentDateTime <= Config.REGISTRATION_CLOSE_TIME_MS;
}
