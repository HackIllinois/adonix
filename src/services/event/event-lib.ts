import { FilteredEvent, UnfilteredEvent } from "./event-models";

/**
 * Convert a noncamelcased event into a more camelcased event
 * @param event Uncapitalized event to convert into camelcase
 * @returns Camelcased event
 */
export function camelcaseEvent(event: UnfilteredEvent): FilteredEvent {
	const newEvent: FilteredEvent = {
		id: event.id,
		name: event.name,
		description: event.description,
		startTime: event.starttime,
		endTime: event.endtime,
		locations: event.locations,
		sponsor: event.sponsor,
		eventType: event.eventtype,
		points: event.points,
		isAsync: event.isasync,
		isPrivate: event.isprivate,
		displayOnStaffCheckIn: event.displayonstaffcheckin,
	};

	return newEvent;
}
