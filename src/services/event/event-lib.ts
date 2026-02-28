import { FilterQuery } from "mongoose";
import { Role } from "../auth/auth-schemas";
import { Event } from "./event-schemas";
import Config from "../../common/config";
import { createHash } from "crypto";

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

/**
 * Returns an event QR code generated from an event id, intended to make event qr codes private from event id
 * @param eventId The event id to generate a qr for
 * @returns The qr code
 */
export function getEventQRCode(eventId: string): string {
    const data = `${eventId}:${Config.EVENT_SECRET}`;
    const hash = createHash("sha256").update(data).digest();
    return `${eventId}:${hash.toString("base64")}`;
}
