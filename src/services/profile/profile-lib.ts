import { AttendeeProfile } from "./profile-schemas";
import { UpdateQuery } from "mongoose";
import Models from "../../common/models";

export async function updatePointsAndCoins(userId: string, amount: number): Promise<AttendeeProfile | null> {
    await updateCoins(userId, amount);

    const updateQuery: UpdateQuery<AttendeeProfile> = {
        $inc: {
            points: amount,
        },
    };

    return Models.AttendeeProfile.findOneAndUpdate({ userId: userId }, updateQuery, { new: true });
}

/**
 * Change a user's coins by a specific amount.
 * @param userId ID of the user to modify
 * @param amount Amount of coins to change (note that this can be a negative number too!)
 * @returns Promise containing the new user, or the actual attendee profile
 */
export async function updateCoins(userId: string, amount: number): Promise<AttendeeProfile | null> {
    const updateQuery: UpdateQuery<AttendeeProfile> = {
        $inc: {
            coins: amount,
        },
    };

    return Models.AttendeeProfile.findOneAndUpdate({ userId: userId }, updateQuery, { new: true });
}

/**
 * Get user's current coin balance.
 * @param userId ID of target user
 * @returns Coin amount (number)
 */
export async function getCoins(userId: string): Promise<number | null> {
    const profile = await Models.AttendeeProfile.findOne({ userId: userId });

    if (profile) {
        return profile.coins;
    } else {
        return 0;
    }
}
