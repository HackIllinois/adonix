import Config from "../../config.js";
import Models from "../../database/models.js";
import { RegistrationApplication } from "../../database/registration-db.js";

export function getApplication(userId: string): Promise<RegistrationApplication | null> {
    return Models.RegistrationApplication.findOne({ userId: userId });
}

export function isRegistrationAlive(): boolean {
    const currentDateTime = new Date().getTime();

    return currentDateTime <= Config.REGISTRATION_CLOSE_TIME;
}
