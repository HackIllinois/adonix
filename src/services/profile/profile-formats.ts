import { AttendeeProfile } from "../../database/attendee-db.js";

export function isValidProfileModel(profile: AttendeeProfile): boolean {
    if (!profile) {return false;}
    if (!profile.avatarUrl || !profile.discordName || !profile.displayName) {return false;}
    if (
        typeof profile.discordName !== "string" ||
        typeof profile.displayName !== "string" ||
        typeof profile.avatarUrl !== "string"
    )
        {return false;}
    return true;
}
