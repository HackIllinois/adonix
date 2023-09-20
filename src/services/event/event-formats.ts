import { Location, EVENT_TYPE } from "./event-models.js";


// Interface for the actual event
export interface EventFormat {
	id: string,
	name: string,
	description: string,
	startTime: number,
	endTime: number,
	locations: Location[],
	sponsor: string,
	eventType: EVENT_TYPE,
	points: number,
	isAsync: boolean,
	isPrivate: boolean,
	displayOnStaffCheckIn: boolean,
}


/**
 * Checks whether an object conforms to the structure of an EventFormat.
 *
 * @param obj - The object to be checked.
 * @returns True if the object is a valid EventFormat, otherwise False.
 *
 */
export function isEventFormat(obj: EventFormat): boolean {
	if (
		typeof obj !== "object" ||
		typeof obj.isPrivate !== "boolean" ||
		typeof obj.displayOnStaffCheckIn !== "boolean" ||
		typeof obj.id !== "string" ||
		typeof obj.name !== "string" ||
		typeof obj.description !== "string" ||
		typeof obj.startTime !== "number" ||
		typeof obj.endTime !== "number"
	) {
		return false;
	}

	if (!Array.isArray(obj.locations)) {
		return false;
	}

	for (const loc of obj.locations) {
		if (
			typeof loc !== "object" ||
			typeof loc.description !== "string" ||
			!Array.isArray(loc.tags) ||
			typeof loc.latitude !== "number" ||
			typeof loc.longitude !== "number"
		) {
			return false;
		}
	}

	if (
		typeof obj.sponsor !== "string" ||
		typeof obj.eventType !== "string" ||
		!Object.values(EVENT_TYPE).includes(obj.eventType) ||
		typeof obj.points !== "number" ||
		typeof obj.isAsync !== "boolean"
	) {
		return false;
	}
	console.log("D");
	return true;
}
