export interface ProfilePreFormat {
    userId: string;
    avatarId: string;
    discordTag: string;
    displayName: string;
    points: number;
    coins: number;
}

export interface ProfileFormat {
    userId: string;
    avatarUrl: string;
    discordTag: string;
    displayName: string;
    points: number;
    coins: number;
}

export function isValidProfileFormat(profile: ProfilePreFormat): boolean {
    if (!profile) {
        return false;
    }

    if (!profile.userId || !profile.avatarId || !profile.discordTag || !profile.displayName) {
        return false;
    }

    if (
        typeof profile.userId !== "string" ||
        typeof profile.discordTag !== "string" ||
        typeof profile.displayName !== "string" ||
        typeof profile.avatarId !== "string"
    ) {
        return false;
    }
    return true;
}
