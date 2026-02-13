import { AttendeeProfile } from "./profile-schemas";
import { UpdateQuery } from "mongoose";
import Models from "../../common/models";

export async function updatePoints(userId: string, amount: number): Promise<AttendeeProfile | null> {
    const updateQuery: UpdateQuery<AttendeeProfile> = {
        $inc: {
            points: amount,
            // Only accumulate positive additions, don't decrement on negative
            pointsAccumulated: Math.max(0, amount),
        },
    };

    return Models.AttendeeProfile.findOneAndUpdate({ userId: userId }, updateQuery, { new: true });
}

export async function updateRafflePoints(userId: string, amount: number, sidequestId?: number): Promise<AttendeeProfile | null> {
    const profile = await Models.AttendeeProfile.findOne({ userId });
    if (!profile) {
        return null;
    }

    const lastSidequestId = profile.lastSidequestId;
    const currentStreak = profile.streak || 0;
    let newStreak = 1;
    if (lastSidequestId !== undefined && sidequestId === lastSidequestId + 1) {
        newStreak = currentStreak + 1;
    } else if (sidequestId !== lastSidequestId) {
        newStreak = 1;
    } else {
        newStreak = currentStreak;
    }

    // Multiplier for current streak: 1.2^(streak-1)
    const STREAK_MULTIPLIER_BASE = 1.2;
    const multiplier = Math.pow(STREAK_MULTIPLIER_BASE, newStreak - 1);
    const effectiveAmount = amount * multiplier;

    const updateQuery: UpdateQuery<AttendeeProfile> = {
        $inc: { rafflePoints: effectiveAmount },
        $set: {
            lastSidequestId: sidequestId,
            streak: newStreak,
        },
    };

    return Models.AttendeeProfile.findOneAndUpdate({ userId }, updateQuery, { new: true });
}

export function getAvatarUrlForId(avatarId: string): string {
    return `https://raw.githubusercontent.com/HackIllinois/adonix-metadata/main/avatars/${avatarId}.png`;
}
