import { RouterError } from "../../middleware/error-handler";
import { StaffShift } from "../../database/staff-db";
import { isArrayOfType, isString } from "../../common/formatTools";
import { AttendeeProfile } from "../../database/attendee-db";

// Format for default staff attendance input
export interface AttendanceFormat {
    eventId: string;
}

export function isValidAttendanceFormat(obj: AttendanceFormat): boolean {
    return typeof obj.eventId === "string";
}

export function isValidStaffShiftFormat(obj: StaffShift): boolean {
    if (!isString(obj.userId)) {
        return false;
    }

    if (!isArrayOfType(obj.shifts, isString)) {
        return false;
    }

    return true;
}

export interface EventError {
    statuscode: number;
    name: string;
}

export interface checkInResult {
    success: boolean;
    error?: RouterError;
    profile?: AttendeeProfile;
}
