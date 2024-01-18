export interface ProfileFormat {
    userId: string;
    avatarUrl: string;
    discordTag: string;
    displayName: string;
    points: number;
    coins: number;
}

export function isValidProfileFormat(profile: ProfileFormat): boolean {
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
