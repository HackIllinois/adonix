import Models from "../../common/models";
import { Duel } from "./duel-schemas";
import { updatePoints } from "../profile/profile-lib";

const WINNING_SCORE = 3;
const WINNING_POINTS = 5;
const PARTICIPATION_POINTS = 1;
const MAX_DUELS = 25; // Max duels that count for points

export async function checkGameStatus(duelId: string, duel: Duel): Promise<void> {
    // First to reach 3 points wins the duel
    const playerHasWon = duel.hostScore === WINNING_SCORE || duel.guestScore === WINNING_SCORE;

    if (playerHasWon && !duel.hasFinished) {
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

        if (duel.isScoringDuel && winnerProfile.duelsPlayed < MAX_DUELS) {
            await updatePoints(winnerId, WINNING_POINTS);
        }

        winnerProfile.duelsPlayed += 1;
        winnerProfile.duelsWon += 1;
        await winnerProfile.save();

        if (duel.isScoringDuel && loserProfile.duelsPlayed < MAX_DUELS) {
            await updatePoints(loserId, PARTICIPATION_POINTS);
        }

        loserProfile.duelsPlayed += 1;
        await loserProfile.save();

        await Models.Duel.updateOne({ _id: duelId }, { $set: { hasFinished: true } });
    }

    if (duel.hostHasDisconnected || duel.guestHasDisconnected) {
        await Models.Duel.updateOne({ _id: duelId }, { $set: { hasFinished: true, isScoringDuel: false } });
    }
}
