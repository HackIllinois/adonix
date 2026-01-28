import Models from "../../common/models";
import { AttendeeTeam } from "./attendee-team-schemas";

export async function updateTeamPoints(team: string, amount: number): Promise<AttendeeTeam | null> {
    return Models.AttendeeTeam.findOneAndUpdate({ name: team }, { $inc: { points: amount } }, { new: true });
}

export async function assignAttendeeTeams(): Promise<AttendeeTeam[]> {
    const teams = await Models.AttendeeTeam.find({}, { name: 1 });
    if (teams.length === 0) {
        throw new Error("No teams available to assign");
    }

    const attendees = await Models.AttendeeProfile.find({ team: { $exists: false } }, { userId: 1 }).lean();
    if (attendees.length === 0) {
        throw new Error("No unassigned attendees found");
    }

    // Track how many get assigned to each team
    const teamCounts = teams.map((t) => ({
        name: t.name,
        members: 0,
    }));

    // Build bulk ops for attendee assignment
    const profileOps = attendees.map((profile: { userId: string }, idx: number) => {
        const assignedTeam = teamCounts[idx % teamCounts.length]!;
        assignedTeam.members += 1;
        return {
            updateOne: {
                filter: { userId: profile.userId },
                update: { $set: { team: assignedTeam.name } },
            },
        };
    });

    await Models.AttendeeProfile.bulkWrite(profileOps, { ordered: false });

    // Update team member counts
    const teamOps = teamCounts.map((t) => ({
        updateOne: {
            filter: { name: t.name },
            update: { $inc: { members: t.members } },
        },
    }));

    await Models.AttendeeTeam.bulkWrite(teamOps, { ordered: false });

    return Models.AttendeeTeam.find();
}
