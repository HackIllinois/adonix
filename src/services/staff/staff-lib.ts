import Models from "../../database/models.js";
import { StatusCode } from "status-code-enum";
import { isValidAttendanceCheckInResult } from "./staff-formats.js";

export async function isValidAttendanceCheckIn(eventId: string, userId: string): Promise<isValidAttendanceCheckInResult> {
    const eventAttendance = await Models.EventAttendance.findOne({ eventId: eventId });

    if (!eventAttendance) {
        return { success: false, error: { statuscode: StatusCode.ClientErrorNotFound, name: "EventNotFound" } };
    }

    if (eventAttendance.attendees.includes(userId)) {
        return { success: false, error: { statuscode: StatusCode.ClientErrorBadRequest, name: "AlreadyCheckedIn" } };
    }

    return { success: true };
}
