import { AttendeeProfile } from "./profile-schemas";
import Models from "../../common/models";

export const BRONZE_PTS = 600;
export const SILVER_PTS = 800;
export const GOLD_PTS = 1000;

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
                                { case: { $gte: ["$pointsAccumulated", GOLD_PTS] }, then: "Gold" },
                                { case: { $gte: ["$pointsAccumulated", SILVER_PTS] }, then: "Silver" },
                                { case: { $gte: ["$pointsAccumulated", BRONZE_PTS] }, then: "Bronze" },
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
