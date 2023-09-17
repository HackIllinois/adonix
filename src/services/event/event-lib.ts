import { BaseEvent, GenericEvent, PrivateEvent } from "./event-models";


/**
 * Convert a noncamelcased event into a more camelcased event
 * @param baseEvent Uncapitalized event to convert into camelcase
 * @param hasElevatedPerms Whether or not the results are going to an elevated user (display private events?)
 * @returns Camelcased event
 */
export function camelcaseEvent(baseEvent: BaseEvent, hasElevatedPerms: boolean): GenericEvent {
	const base: GenericEvent = {
		id: baseEvent.id,
		name: baseEvent.name,
		description: baseEvent.description,
		startTime: baseEvent.starttime,
		endTime: baseEvent.endtime,
		locations: baseEvent.locations,
		sponsor: baseEvent.sponsor,
		eventType: baseEvent.eventtype,
		points: baseEvent.points,
		isAsync: baseEvent.isasync,
	};

	if (hasElevatedPerms) {
		const newEvent: PrivateEvent = base as PrivateEvent;
		newEvent.isPrivate = baseEvent.isprivate;
		newEvent.displayOnStaffCheckIn = baseEvent.displayonstaffcheckin;
		return newEvent;
	}

	return base;
}
