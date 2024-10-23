import Models from "../../database/models";
import { StatusCode } from "status-code-enum";
import { updatePointsAndCoins } from "../profile/profile-lib";
import { AlreadyCheckedInError, AlreadyCheckedInErrorSchema } from "../user/user-schemas";
import { AttendeeProfile } from "../../database/attendee-db";
import { Specification } from "../../middleware/specification";
import { EventNotFoundError, EventNotFoundErrorSchema } from "../event/event-schemas";

export type PerformCheckInResult =
    | { success: true; profile: AttendeeProfile; points: number }
    | {
          success: false;
          status: StatusCode.ClientErrorBadRequest;
          error: AlreadyCheckedInError;
      }
    | {
          success: false;
          status: StatusCode.ClientErrorNotFound;
          error: EventNotFoundError;
      };

export const PerformCheckInErrors = {
    [StatusCode.ClientErrorBadRequest]: {
        description: "User already checked in",
        schema: AlreadyCheckedInErrorSchema,
    },
    [StatusCode.ClientErrorNotFound]: {
        description: "Could not find the event to check into",
        schema: EventNotFoundErrorSchema,
    },
} satisfies Specification["responses"];

export async function performCheckIn(eventId: string, userId: string): Promise<PerformCheckInResult> {
    const event = await Models.Event.findOne({ eventId: eventId });
    if (!event) {
        return { success: false, status: StatusCode.ClientErrorNotFound, error: EventNotFoundError };
    }

    const eventAttendance = await Models.EventAttendance.findOne({ eventId: eventId });

    if (eventAttendance && eventAttendance.attendees.includes(userId)) {
        return { success: false, status: StatusCode.ClientErrorBadRequest, error: AlreadyCheckedInError };
    }

    await Models.UserAttendance.findOneAndUpdate({ userId: userId }, { $addToSet: { attendance: eventId } }, { upsert: true });
    await Models.EventAttendance.findOneAndUpdate({ eventId: eventId }, { $addToSet: { attendees: userId } }, { upsert: true });

    const points = event.points || 0;
    const newProfile = await updatePointsAndCoins(userId, points);

    if (!newProfile) {
        throw Error("No profile exists, cannot checkin");
    }

    return { success: true, profile: newProfile, points };
}
