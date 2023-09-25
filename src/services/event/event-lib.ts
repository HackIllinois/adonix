import { PrivateEvent, PublicEvent } from "./event-models";


/**
 * Truncates a PrivateEvent object to create a PublicEvent by omitting
 * the 'isPrivate' and 'displayOnStaffCheckIn' properties.
 *
 * @param privateEvent The object to convert into a public event.
 * @returns The truncated PublicEvent object.
 */
export function truncateToPublicEvent(privateEvent: PrivateEvent | PublicEvent): PublicEvent {
	const publicEvent: PublicEvent = {
		id: privateEvent.id,
		name: privateEvent.name,
		description: privateEvent.description,
		startTime: privateEvent.startTime,
		endTime: privateEvent.endTime,
		locations: privateEvent.locations,
		sponsor: privateEvent.sponsor,
		eventType: privateEvent.eventType,
		points: privateEvent.points,
		isAsync: privateEvent.isAsync,
	};
	return publicEvent;
}
