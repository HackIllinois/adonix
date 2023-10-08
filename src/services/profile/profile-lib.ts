import { AttendeeProfile } from "../../database/attendee-db.js";
import Constants from "../../constants.js";
import { LeaderboardEntry } from "./profile-models.js";

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
    return limit > Constants.ZERO;
}
