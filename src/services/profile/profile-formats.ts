import { AttendeeProfile } from "../../database/attendee-db";

export function isValidProfileFormat(profile: AttendeeProfile): boolean {
    if (!profile) {
        return false;
    }

    if (!profile.userId || !profile.avatarUrl || !profile.discordTag || !profile.displayName) {
        return false;
    }

    if (
        typeof profile.userId !== "string" ||
        typeof profile.discordTag !== "string" ||
        typeof profile.displayName !== "string" ||
        typeof profile.avatarUrl !== "string"
    ) {
        return false;
    }
    return true;
}
