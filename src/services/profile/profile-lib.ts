import { AttendeeProfile } from "./profile-schemas";
import { UpdateQuery } from "mongoose";
import Models from "../../common/models";
import { EventType } from "../event/event-schemas";

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

export async function updateRafflePoints(
    userId: string,
    amount: number,
    eventType?: EventType,
    sidequestId?: number
): Promise<AttendeeProfile | null> {
    if (eventType !== EventType.SIDEQUEST || sidequestId === undefined) {
        return Models.AttendeeProfile.findOne({ userId });
    }

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

    // Compute multiplier e.g. 4 hour streak = 1+(1.2^1)+(1.2^2)+(1.2^3) = 5.368
    const STREAK_MULTIPLIER_BASE = 1.2;
    let multiplier = 0;
    for (let i = 0; i < newStreak; i++) {
        multiplier += Math.pow(STREAK_MULTIPLIER_BASE, i);
    }
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
