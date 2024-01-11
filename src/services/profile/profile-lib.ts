import { AttendeeProfile } from "../../database/attendee-db.js";
import { LeaderboardEntry } from "./profile-models.js";
import { UpdateQuery } from "mongoose";
import Models from "../../database/models.js";

/**
 * Remove non-necessary fields from a leaderboardentry item
 * @param initial Initial entry with extra items
 * @returns New LeaderboardEntry, but this time with only the needed fields
 */
export function castLeaderboardEntries(initial: AttendeeProfile): LeaderboardEntry {
    const final: LeaderboardEntry = {
        points: initial.points,
        displayName: initial.displayName,
    };
    return final;
}

/**
 * Check if the limit is valid or not
 * @param limit Initial value to check
 * @returns True if limit is non-negative, else false
 */
export function isValidLimit(limit: number): boolean {
    return limit > 0;
}

/**
 * Change a user's points by a specific amount.
 * @param userId ID of the user to modify
 * @param amount Amount of points to change (note that this can be a negative number too!)
 * @returns Promise containing the new user, or the actual attendee profile
 */
export async function updatePoints(userId: string, amount: number): Promise<AttendeeProfile | null> {
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
    var profile = await Models.AttendeeProfile.findOne({userId: userId}); 

    if (profile) {
        return profile.coins;
    } else {
        return 0; 
    }
}
