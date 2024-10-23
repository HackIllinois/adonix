import { FilterQuery } from "mongoose";
import { Role } from "../auth/auth-schemas";
import { Event, PublicEvent } from "./event-schemas";

/**
 * Truncates a event into a public event by removing metadata (namely exp)
 * @param event The event to filter
 * @returns The filtered event
 */
export function filterEvent(event: Event): PublicEvent {
    return {
        eventId: event.eventId,
        isStaff: event.isStaff,
        name: event.name,
        description: event.description,
        startTime: event.startTime,
        endTime: event.endTime,
        eventType: event.eventType,
        locations: event.locations,
        isAsync: event.isAsync,
        mapImageUrl: event.mapImageUrl,
        sponsor: event.sponsor,
        points: event.points,
        isPrivate: event.isPrivate,
        displayOnStaffCheckIn: event.displayOnStaffCheckIn,
        isPro: event.isPro,
    };
}

/**
 * Returns a filter query to filter out events that the roles specified cannot access
 * @param roles The roles to restrict by
 * @returns A filter query to restrict events based on roles
 */
export function restrictEventsByRoles(roles: Role[]): FilterQuery<Event> {
    if (roles.includes(Role.STAFF)) {
        return {};
    } else if (roles.includes(Role.PRO)) {
        return { isPrivate: false, isStaff: false };
    } else {
        return { isPrivate: false, isStaff: false, isPro: false };
    }
}
