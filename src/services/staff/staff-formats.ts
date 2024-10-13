import { RouterError } from "../../middleware/error-handler";
import { StaffShift } from "../../database/staff-db";
import { isArrayOfType, isString } from "../../common/formatTools";
import { AttendeeProfile } from "../../database/attendee-db";
import {
    AlreadyCheckedInErrorSchema,
    EventNotFoundErrorSchema,
    type AlreadyCheckedInError,
    type EventNotFoundError,
} from "../user/user-schemas";
import StatusCode from "status-code-enum";
import { Specification } from "../../middleware/specification";

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

export type CheckInResult =
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

export const CheckInErrors = {
    [StatusCode.ClientErrorBadRequest]: {
        description: "User already checked in",
        schema: AlreadyCheckedInErrorSchema,
    },
    [StatusCode.ClientErrorNotFound]: {
        description: "Could not find the event to check into",
        schema: EventNotFoundErrorSchema,
    },
} satisfies Specification["responses"];
