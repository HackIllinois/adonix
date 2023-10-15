import { AttendeeProfile } from "../../database/attendee-db.js";

export function isValidProfileModel(profile: AttendeeProfile): boolean {
    if (!profile) {
        return false;
    }
    if (!profile.avatarUrl || !profile.discordTag || !profile.displayName) {
        return false;
    }
    if (
        typeof profile.discordTag !== "string" ||
        typeof profile.displayName !== "string" ||
        typeof profile.avatarUrl !== "string"
    ) {
        return false;
    }
    return true;
}
