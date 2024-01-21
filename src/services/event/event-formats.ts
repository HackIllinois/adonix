import { isArrayOfType, isBoolean, isEnumOfType, isNumber, isObject, isString } from "../../formatTools.js";
import Config from "../../config.js";
import { Event, Location } from "../../database/event-db.js";
import { PUBLIC_EVENT_TYPE, STAFF_EVENT_TYPE } from "./event-models.js";

export function isValidEvent(event: Event): boolean {
    if (!isValidBase) {
        return false;
    }
    return event.isStaff ? isValidStaffEvent(event) : isValidPublicEvent(event);
}

/**
 * Checks whether an object conforms to the structure of a Location.
 *
 * @param loc The Location object to be checked.
 * @returns True if the object is a valid Location, otherwise False.
 *
 */
function isLocation(obj: unknown): boolean {
    const loc = obj as Location;
    return (
        isObject(obj) &&
        isString(loc.description) &&
        isArrayOfType(loc.tags, isString) &&
        isNumber(loc.latitude) &&
        isNumber(loc.longitude)
    );
}

/**
 * Checks whether an object conforms to the structure of BaseEventFormat.
 *
 * @param obj - The object to be checked.
 * @returns True if the object is a valid BaseEventFormat, otherwise False.
 *
 */
/* eslint-disable no-magic-numbers */
function isValidBase(obj: Event): boolean {
    return (
        isString(obj.eventId) &&
        obj.eventId.length == Config.EVENT_ID_LENGTH &&
        isBoolean(obj.isStaff) &&
        isString(obj.name) &&
        isString(obj.description) &&
        isNumber(obj.startTime) &&
        obj.startTime >= 0 &&
        isNumber(obj.endTime) &&
        obj.endTime >= 0 &&
        obj.startTime < obj.endTime &&
        isString(obj.eventType) &&
        (isNumber(obj.exp) || obj.exp === undefined) &&
        isArrayOfType(obj.locations, isLocation) &&
        isBoolean(obj.isAsync)
    );
}

/**
 * Checks whether an object conforms to the structure of AttendeeEventFormat.
 *
 * @param event - The object to be checked.
 * @returns True if the object is a valid AttendeeEventFormat, otherwise False.
 *
 */
function isValidPublicEvent(event: Event): boolean {
    return (
        isString(event.mapImageUrl) &&
        (isString(event.sponsor) || event.sponsor === undefined) &&
        isEnumOfType(event.eventType, PUBLIC_EVENT_TYPE) &&
        isNumber(event.points) &&
        event.points != undefined &&
        event.points >= 0
    );
}

/**
 * Checks whether an object conforms to the structure of AttendeeEventFormat.
 *
 * @param event - The object to be checked.
 * @returns True if the object is a valid AttendeeEventFormat, otherwise False.
 *
 */
function isValidStaffEvent(event: Event): boolean {
    return isEnumOfType(event.eventType, STAFF_EVENT_TYPE)
}

// Input format for changing event expiration
export interface MetadataFormat {
    eventId: string;
    exp: number;
}

/**
 *
 * @param event Input expiration format object
 * @returns Boolean representing whether or not the object is a valid expiration object
 */
export function isValidMetadataFormat(event: MetadataFormat): boolean {
    return (
        isString(event.eventId) &&
        event.eventId.length == Config.EVENT_ID_LENGTH &&
        (isNumber(event.exp) || event.exp === undefined)
    );
}
