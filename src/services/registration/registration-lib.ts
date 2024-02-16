import Config from "../../config.js";
import Models from "../../database/models.js";
import { RegistrationApplication } from "../../database/registration-db.js";

export function getApplication(userId: string): Promise<RegistrationApplication | null> {
    return Models.RegistrationApplication.findOne({ userId: userId });
}

export function isRegistrationAlive(): boolean {
    const targetDateTime = new Date(Config.REGISTRATION_CLOSE_DATETIME);
    const currentDate = new Date().toLocaleString("en-US", { timeZone: "America/Chicago" });
    const currentDateTime = new Date(currentDate + "-06:00");

    return currentDateTime < targetDateTime;
}
