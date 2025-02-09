import { AttendeeProfile } from "./profile-schemas";
import { UpdateQuery } from "mongoose";
import Models from "../../common/models";

export async function updatePoints(userId: string, amount: number): Promise<AttendeeProfile | null> {
    const updateQuery: UpdateQuery<AttendeeProfile> = {
        $inc: {
            points: amount,
            // Only accumulate positive additions, don't decrement on negative
            pointsAccumulated: Math.max(0, amount),
        },
    };

    return Models.AttendeeProfile.findOneAndUpdate({ userId: userId }, updateQuery, { new: true });
}

/**
 * Get user's current point balance.
 * @param userId ID of target user
 * @returns Point amount (number)
 */
export async function getPoints(userId: string): Promise<number | null> {
    const profile = await Models.AttendeeProfile.findOne({ userId: userId });

    if (profile) {
        return profile.points;
    } else {
        return 0;
    }
}
