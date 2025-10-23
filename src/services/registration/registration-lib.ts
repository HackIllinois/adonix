import Config from "../../common/config";
import Models from "../../common/models";
import { RegistrationApplicationDraft, RegistrationApplicationSubmitted } from "./registration-schemas";

export async function getApplication(userId: string): Promise<RegistrationApplicationDraft | RegistrationApplicationSubmitted | null> {
    let registrationData = await Models.RegistrationApplicationSubmitted.findOne({ userId });
    if (!registrationData) {
        registrationData = await Models.RegistrationApplicationDraft.findOne({ userId });
    }
    return registrationData;
}

export function isRegistrationAlive(): boolean {
    const currentTime = Math.floor(Date.now() / Config.MILLISECONDS_PER_SECOND);
    return currentTime <= Config.REGISTRATION_CLOSE_TIME;
}
