import Models from "../../common/models";
import { Duel } from "./duel-schemas";
import { updatePoints } from "../profile/profile-lib";

export async function checkGameStatus(duelId: string, duel: Duel): Promise<void> {
    // First to reach 3 points gets 10 points
    if (duel.hostScore == 3 || duel.guestScore == 3) {
        const winnerId = duel.hostScore == 3 ? duel.hostId : duel.guestId;
        await updatePoints(winnerId, 10);
        await Models.Duel.updateOne({ _id: duelId }, { $set: { hasFinished: true } });
    }
}
