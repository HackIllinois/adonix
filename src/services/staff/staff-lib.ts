import Models from "../../database/models";
import { StatusCode } from "status-code-enum";
import { checkInResult } from "./staff-formats";
import { RouterError } from "../../middleware/error-handler";
import { updatePointsAndCoins } from "../profile/profile-lib";
import { isNumber } from "../../common/formatTools";

export async function performCheckIn(eventId: string, userId: string, points: number = 0): Promise<checkInResult> {
    const eventAttendance = await Models.EventAttendance.findOne({ eventId: eventId });

    if (!eventAttendance) {
        const error = new RouterError(StatusCode.ClientErrorNotFound, "EventNotFound");
        return { success: false, error };
    }

    if (eventAttendance.attendees.includes(userId)) {
        const error = new RouterError(StatusCode.ClientErrorBadRequest, "AlreadyCheckedIn");
        return { success: false, error };
    }

    await Models.UserAttendance.findOneAndUpdate({ userId: userId }, { $addToSet: { attendance: eventId } }, { upsert: true });
    await Models.EventAttendance.findOneAndUpdate({ eventId: eventId }, { $addToSet: { attendees: userId } }, { upsert: true });

    if (!isNumber(points)) {
        const event = await Models.Event.findOne({ eventId: eventId });
        points = event?.points ?? 0;
    }

    const newProfile = await updatePointsAndCoins(userId, points);

    if (!newProfile) {
        return { success: false, error: new RouterError(StatusCode.ServerErrorInternal, "NoPointsUpdate") };
    }

    return { success: true, profile: newProfile };
}
