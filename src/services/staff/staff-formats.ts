import { StaffShift } from "../../database/staff-db.js";
import { isArrayOfType, isString } from "../../formatTools.js";

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

export interface isValidAttendanceCheckInResult {
    success: boolean;
    error?: EventError;
}
