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

export async function recalculateTiers(tier1Pts: number, tier2Pts: number, tier3Pts: number): Promise<number> {
    const result = await Models.AttendeeProfile.updateMany({}, [
        {
            $set: {
                tier: {
                    $switch: {
                        branches: [
                            { case: { $gte: ["$pointsAccumulated", tier1Pts] }, then: 1 },
                            { case: { $gte: ["$pointsAccumulated", tier2Pts] }, then: 2 },
                            { case: { $gte: ["$pointsAccumulated", tier3Pts] }, then: 3 },
                        ],
                        default: "$$REMOVE",
                    },
                },
            },
        },
    ]);
    return result.modifiedCount;
}

export function getAvatarUrlForId(avatarId: string): string {
    return `https://raw.githubusercontent.com/HackIllinois/adonix-metadata/main/avatars/${avatarId}.png`;
}
