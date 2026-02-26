import { createHash } from "crypto";
import { AttendeeProfile } from "./profile-schemas";
import Models from "../../common/models";

export const TIER_3_PTS = 10;
export const TIER_2_PTS = 300;
export const TIER_1_PTS = 700;

export async function updatePoints(userId: string, amount: number): Promise<AttendeeProfile | null> {
    const updated = await Models.AttendeeProfile.findOneAndUpdate(
        { userId },
        [
            {
                $set: {
                    points: { $add: ["$points", amount] },
                    pointsAccumulated: {
                        // Only accumulate positive additions, don't decrement on negative
                        $add: ["$pointsAccumulated", Math.max(0, amount)],
                    },
                },
            },
            {
                // Atomically updates tier based on new points accumulated
                $set: {
                    tier: {
                        $switch: {
                            branches: [
                                { case: { $gte: ["$pointsAccumulated", TIER_1_PTS] }, then: 1 },
                                { case: { $gte: ["$pointsAccumulated", TIER_2_PTS] }, then: 2 },
                                { case: { $gte: ["$pointsAccumulated", TIER_3_PTS] }, then: 3 },
                            ],
                            default: "$tier",
                        },
                    },
                },
            },
        ],
        { new: true },
    );

    return updated;
}

export function getAvatarUrlForId(avatarId: string): string {
    return `https://raw.githubusercontent.com/HackIllinois/adonix-metadata/main/avatars/${avatarId}.png`;
}

export async function assignTeamByUserId(userId: string): Promise<{ team: string; teamBadge: string }> {
    const teams = await Models.AttendeeTeam.find({}, { name: 1, badge: 1 });
    if (teams.length === 0) {
        throw new Error("No teams available to assign");
    }

    const hash = createHash("sha256").update(userId).digest();
    const index = hash.readUInt32BE(0) % teams.length;
    const assignedTeam = teams[index]!;

    await Models.AttendeeTeam.updateOne({ name: assignedTeam.name }, { $inc: { members: 1 } });

    return { team: assignedTeam.name, teamBadge: assignedTeam.badge };
}
