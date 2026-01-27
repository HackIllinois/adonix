import Models from "../../common/models";

export async function updateTeamPoints(team: string, amount: number) {
    return Models.AttendeeTeam.findOneAndUpdate({ name: team }, { $inc: { points: amount } }, { new: true });
}
