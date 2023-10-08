import Constants from "../../constants.js";
import { Location, PUBLIC_EVENT_TYPE, STAFF_EVENT_TYPE } from "./event-models.js";

// Base format for the event - ALL events must have these
export interface BaseEventFormat {
    _id?: string;
    eventId: string;
    name: string;
    description: string;
    startTime: number;
    endTime: number;
    locations: Location[];
    isAsync: boolean;
    isStaff: boolean;
}

// Interface for the attendee event
export interface PublicEventFormat extends BaseEventFormat {
    sponsor: string;
    publicEventType: PUBLIC_EVENT_TYPE;
    points: number;
    isPrivate: boolean;
    displayOnStaffCheckIn: boolean;
}

// Empty interface, allows for easier code readability
export interface StaffEventFormat extends BaseEventFormat {
    staffEventType: STAFF_EVENT_TYPE;
}
export interface GenericEventFormat extends PublicEventFormat, StaffEventFormat {}

/**
 * Checks whether an object conforms to the structure of a Location.
 *
 * @param loc The Location object to be checked.
 * @returns True if the object is a valid Location, otherwise False.
 *
 */
function isLocation(loc: Location): boolean {
    if (
        typeof loc !== "object" ||
        typeof loc.description !== "string" ||
        !Array.isArray(loc.tags) ||
        typeof loc.latitude !== "number" ||
        typeof loc.longitude !== "number"
    ) {
        return false;
    }
    return true;
}

/**
 * Checks whether an object conforms to the structure of BaseEventFormat.
 *
 * @param obj - The object to be checked.
 * @returns True if the object is a valid BaseEventFormat, otherwise False.
 *
 */
/* eslint-disable no-magic-numbers */
function isValidBaseEventFormat(obj: BaseEventFormat): boolean {
    if (typeof obj.eventId !== "string" || obj.eventId.length !== Constants.EVENT_ID_LENGTH) {
        return false;
    }
    if (
        typeof obj.name !== "string" ||
        typeof obj.description !== "string" ||
        typeof obj.startTime !== "number" ||
        obj.startTime < 0 ||
        typeof obj.endTime !== "number" ||
        obj.endTime < 0 ||
        obj.endTime < obj.startTime
    ) {
        return false;
    }

    if (!Array.isArray(obj.locations)) {
        return false;
    }

    for (const loc of obj.locations) {
        if (!isLocation(loc)) {
            return false;
        }
    }
    if (typeof obj.isAsync !== "boolean" || typeof obj.isStaff !== "boolean") {
        return false;
    }

    return true;
}

/**
 * Checks whether an object conforms to the structure of AttendeeEventFormat.
 *
 * @param obj - The object to be checked.
 * @returns True if the object is a valid AttendeeEventFormat, otherwise False.
 *
 */
export function isValidPublicFormat(baseEvent: BaseEventFormat): boolean {
    if (!isValidBaseEventFormat(baseEvent)) {
        return false;
    }

    // Cast the object to AttendeeEventFormat
    const obj: PublicEventFormat = baseEvent as PublicEventFormat;

    if (
        typeof obj.sponsor !== "string" ||
        typeof obj.publicEventType !== "string" ||
        !Object.values(PUBLIC_EVENT_TYPE).includes(obj.publicEventType) ||
        typeof obj.points !== "number" ||
        obj.points < 0 ||
        typeof obj.isPrivate !== "boolean" ||
        typeof obj.displayOnStaffCheckIn !== "boolean"
    ) {
        return false;
    }

    return true;
}

/**
 * Checks whether an object conforms to the structure of AttendeeEventFormat.
 *
 * @param obj - The object to be checked.
 * @returns True if the object is a valid AttendeeEventFormat, otherwise False.
 *
 */
export function isValidStaffFormat(baseEvent: BaseEventFormat): boolean {
    if (!isValidBaseEventFormat(baseEvent)) {
        return false;
    }

    // Cast the object to AttendeeEventFormat
    const obj: StaffEventFormat = baseEvent as StaffEventFormat;

    if (typeof obj.staffEventType !== "string" || !Object.values(STAFF_EVENT_TYPE).includes(obj.staffEventType)) {
        return false;
    }

    return true;
}

// Input format for changing event expiration
export interface MetadataFormat {
    eventId: string;
    exp: number;
}

/**
 *
 * @param obj Input expiration format object
 * @returns Boolean representing whether or not the object is a valid expiration object
 */
export function isValidMetadataFormat(obj: MetadataFormat): boolean {
    if (typeof obj.eventId !== "string" || obj.eventId.length !== Constants.EVENT_ID_LENGTH) {
        return false;
    }

    if (typeof obj.exp !== "number" || obj.exp < 0) {
        return false;
    }

    return true;
}
