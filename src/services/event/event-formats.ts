import { ObjectId } from "mongodb";
import Constants from "../../constants.js";
import { Location, EVENT_TYPE } from "./event-models.js";

// Base format for the event - ALL events must have these
export interface BaseEventFormat {
	_id?: ObjectId,
	id: string,
	name: string,
	description: string,
	startTime: number,
	endTime: number,
	locations: Location[],
	isAsync: boolean,
	isStaff: boolean,
}

// Interface for the actual event
export interface AttendeeEventFormat extends BaseEventFormat {
	sponsor: string,
	eventType: EVENT_TYPE,
	points: number,
	isPrivate: boolean,
	displayOnStaffCheckIn: boolean,
}

// Empty interface, allows for easier code readability
export interface StaffEventFormat extends BaseEventFormat { }


export interface AttendanceFormat {
	eventId: string,
}

export interface ExpirationFormat {
	id: string,
	exp: string,
}


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
function isBaseEventFormat(obj: BaseEventFormat): boolean {
	if (typeof obj.id !== "string" || obj.id.length !== Constants.EVENT_ID_LENGTH) {
		return false;
	}

	if (
		typeof obj.name !== "string" ||
		typeof obj.description !== "string" ||
		typeof obj.startTime !== "number" ||obj.startTime < 0 ||
		typeof obj.endTime !== "number" || obj.endTime < 0
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

	if (
		typeof obj.isAsync !== "boolean" ||
		typeof obj.isStaff !== "boolean"
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
export function isAttendeeEventFormat(baseEvent: BaseEventFormat): boolean {
	if (!isBaseEventFormat(baseEvent)) {
		return false;
	}
	
	// Cast the object to AttendeeEventFormat
	const obj: AttendeeEventFormat = baseEvent as AttendeeEventFormat;
	
	if (
		typeof obj.sponsor !== "string" ||
		typeof obj.eventType !== "string" ||
		!Object.values(EVENT_TYPE).includes(obj.eventType) ||
		typeof obj.points !== "number" || obj.points < 0 ||
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
export function isStaffEventFormat(baseEvent: BaseEventFormat): boolean {
	return isBaseEventFormat(baseEvent);
}

export function isExpirationFormat(expData: ExpirationFormat): boolean {
	if (typeof expData.id !== "string" || typeof expData.exp !== "number" || expData.exp <= 0) {
		return false;
	}

	return true;
}
/* eslint-enable no-magic-numbers */
