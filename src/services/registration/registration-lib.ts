import Models from "../../database/models.js";
import { RegistrationApplication } from "../../database/registration-db.js";

export function getApplication(userId: string): Promise<RegistrationApplication | null> {
    return Models.RegistrationApplication.findOne({ userId: userId });
}
