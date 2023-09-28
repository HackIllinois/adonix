// Object containing an entry for the leaderboard
export interface LeaderboardEntry {
	id: string,
	points: number,
	discord: string,
}

export interface Profile {
    id: string,
    firstName: string,
    lastName: string,
    points: number,
    discord: string,
    avatarUrl: string,
    foodWave: number,
}
