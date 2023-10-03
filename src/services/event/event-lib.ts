import { EVENT_TYPE, FilteredEventView, PublicEvent } from "./event-models.js";

/**
 * Truncates a InternalEvent object to create an ExternalEvent by omitting
 * the 'isPrivate', 'displayOnStaffCheckIn', and 'isStaff' properties.
 *
 * @param baseEvent The object to convert into a public event.
 * @returns The truncated ExternalEvent object.
 */
export function createFilteredEventView(baseEvent: PublicEvent): FilteredEventView {
	const publicEvent: FilteredEventView = {
		id: baseEvent.eventId,
		name: baseEvent.name,
		description: baseEvent.description,
		startTime: baseEvent.startTime,
		endTime: baseEvent.endTime,
		locations: baseEvent.locations,
		sponsor: baseEvent.sponsor,
		eventType: baseEvent.eventType as EVENT_TYPE,
		points: baseEvent.points,
		isAsync: baseEvent.isAsync,
	};
	return publicEvent;
}
