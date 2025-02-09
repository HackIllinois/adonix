import { FilterQuery } from "mongoose";
import { Role } from "../auth/auth-schemas";
import { Event } from "./event-schemas";

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
