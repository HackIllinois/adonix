import Models from "../../common/models";
import { Duel } from "./duel-schemas";
import { updatePoints } from "../profile/profile-lib";

const WINNING_SCORE = 3;
const WINNING_POINTS = 10;

export async function checkGameStatus(duelId: string, duel: Duel): Promise<void> {
    // First to reach 3 points gets 10 points
    if (duel.hostScore == WINNING_SCORE || duel.guestScore == WINNING_SCORE) {
        const winnerId = duel.hostScore == WINNING_SCORE ? duel.hostId : duel.guestId;
        await updatePoints(winnerId, WINNING_POINTS);
        await Models.Duel.updateOne({ _id: duelId }, { $set: { hasFinished: true } });
    }
}
