import { PUBLIC_EVENT_TYPE, FilteredEventView } from "./event-models.js";
import { Event } from "../../database/event-db.js";

/**
 * Truncates a InternalEvent object to create an ExternalEvent by omitting
 * the 'isPrivate', 'displayOnStaffCheckIn', and 'isStaff' properties.
 *
 * @param baseEvent The object to convert into a public event.
 * @returns The truncated ExternalEvent object.
 */
export function createFilteredEventView(baseEvent: Event): FilteredEventView {
    const publicEvent: FilteredEventView = {
        eventId: baseEvent.eventId,
        name: baseEvent.name,
        description: baseEvent.description,
        startTime: baseEvent.startTime,
        endTime: baseEvent.endTime,
        locations: baseEvent.locations,
        sponsor: baseEvent.sponsor,
        eventType: baseEvent.eventType as PUBLIC_EVENT_TYPE,
        points: baseEvent.points ?? 0,
        isAsync: baseEvent.isAsync,
        mapImageUrl: baseEvent.mapImageUrl,
        isPro: baseEvent.isPro ?? false,
    };
    return publicEvent;
}
