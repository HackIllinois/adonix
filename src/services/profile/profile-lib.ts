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

export function getAvatarUrlForId(avatarId: string): string {
    return `https://raw.githubusercontent.com/HackIllinois/adonix-metadata/main/avatars/${avatarId}.png`;
}
