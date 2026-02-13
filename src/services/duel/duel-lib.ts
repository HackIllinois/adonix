import Models from "../../common/models";
import { Duel } from "./duel-schemas";
import { updatePoints } from "../profile/profile-lib";
import { AttendeeProfile, DuelStats } from "../profile/profile-schemas";

const WINNING_SCORE = 3;
const WINNING_POINTS = 5;
const PARTICIPATION_POINTS = 1;
const MAX_DUELS = 25; // Max duels that count for points

function ensureDuelStats(profile: AttendeeProfile): DuelStats {
    // Handles old docs
    if (!profile.duelStats) {
        profile.duelStats = {} as DuelStats;
    }
    return profile.duelStats as DuelStats;
}

export async function checkGameStatus(duelId: string, duel: Duel): Promise<void> {
    if (duel.hostHasDisconnected || duel.guestHasDisconnected) {
        await Models.Duel.updateOne({ _id: duelId }, { $set: { hasFinished: true, isScoringDuel: false } });
        return;
    }

    // First to reach 3 points wins the duel
    const playerHasWon = duel.hostScore === WINNING_SCORE || duel.guestScore === WINNING_SCORE;
    if (!playerHasWon || duel.hasFinished) {
        return;
    }

    const hostWon = duel.hostScore === WINNING_SCORE;
    const winnerId = hostWon ? duel.hostId : duel.guestId;
    const loserId = hostWon ? duel.guestId : duel.hostId;

    const profiles = await Models.AttendeeProfile.find({
        userId: { $in: [winnerId, loserId] },
    });

    const winnerProfile = profiles.find((profile) => profile.userId === winnerId);
    const loserProfile = profiles.find((profile) => profile.userId === loserId);

    if (!winnerProfile || !loserProfile) {
        throw new Error("Profile(s) not found");
    }

    const winnerDuelStats = ensureDuelStats(winnerProfile);
    const loserDuelStats = ensureDuelStats(loserProfile);

    if (duel.isScoringDuel && winnerDuelStats.uniqueDuelsPlayed < MAX_DUELS) {
        await updatePoints(winnerId, WINNING_POINTS);
    }

    if (duel.isScoringDuel && loserDuelStats.uniqueDuelsPlayed < MAX_DUELS) {
        await updatePoints(loserId, PARTICIPATION_POINTS);
    }

    // Update duel stats
    winnerDuelStats.duelsPlayed += 1;
    winnerDuelStats.duelsWon += 1;
    if (duel.isScoringDuel) {
        winnerDuelStats.uniqueDuelsPlayed += 1;
    }

    loserDuelStats.duelsPlayed += 1;
    if (duel.isScoringDuel) {
        loserDuelStats.uniqueDuelsPlayed += 1;
    }

    await Promise.all([winnerProfile.save(), loserProfile.save()]);
    await Models.Duel.updateOne({ _id: duelId }, { $set: { hasFinished: true } });
}
