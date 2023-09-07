import { LeaderboardEntry } from "./profile-models";

export function castLeaderboardEntries(initial: LeaderboardEntry): LeaderboardEntry {
	const final: LeaderboardEntry = {
		id: initial.id,
		points: initial.points,
		discord: initial.discord,
	};
	return final;
}
