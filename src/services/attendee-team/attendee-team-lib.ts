import Models from "../../common/models";
import { AttendeeTeam } from "./attendee-team-schemas";

export async function updateTeamPoints(team: string, amount: number): Promise<AttendeeTeam | null> {
    return Models.AttendeeTeam.findOneAndUpdate({ name: team }, { $inc: { points: amount } }, { new: true });
}
