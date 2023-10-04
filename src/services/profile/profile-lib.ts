// import { Request } from "express";
import Constants from "../../constants.js";
import { LeaderboardEntry } from "./profile-models";
// import { MongoNetworkTimeoutError } from "mongodb";
// import { JwtPayload } from "../auth/auth-models.js";
// import { decodeJwtToken } from "../auth/auth-lib.js";


/**
 * Remove non-necessary fields from a leaderboardentry item
 * @param initial Initial entry with extra items
 * @returns New LeaderboardEntry, but this time with only the needed fields
 */
export function castLeaderboardEntries(initial: LeaderboardEntry): LeaderboardEntry {
	const final: LeaderboardEntry = {
		id: initial.id,
		points: initial.points,
		discord: initial.discord,
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

