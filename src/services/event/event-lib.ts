import { Collection, Document, Filter } from "mongodb";
import client from "../../database.js";
import Constants from "../../constants.js";
import { EventDB, ExpirationSchema } from "./event-db.js";
import { ExpirationFormat } from "./event-formats";
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
		id: baseEvent.id,
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

/**
 * Check if the event exists in either the staff collection or the attendee collection/
 * @param eventId ID of the event to check for.
 * @returns True if the event exists in the database, else false if it doesn't.
 */
export async function eventExists(eventId: string | undefined): Promise<boolean> {
	if (!eventId) {
		return Promise.resolve(false);
	}


	const searchFilter: Filter<Document> = { id: eventId };

	const attendeeCollection: Collection = client.db(Constants.EVENT_DB).collection(EventDB.PUBLIC_EVENTS);
	const staffCollection: Collection = client.db(Constants.EVENT_DB).collection(EventDB.STAFF_EVENTS);

	try {
		// Check if event in the attendee collection
		if (await attendeeCollection.countDocuments(searchFilter)) {
			return Promise.resolve(true);
		}

		// Not in attendee collection. Check staff collection
		if (await staffCollection.countDocuments(searchFilter)) {
			return Promise.resolve(true);
		}
		return Promise.resolve(false);
	} catch (error) {
		return Promise.reject(error);
	}
}

/**
 * Check if an event has expired or not.
 * @param eventId ID of the event to check expiry for
 * @returns True if the event has already expired, false if it has not
 */
export async function hasExpired(eventId: string): Promise<boolean> {
	try {
		const isValidEvent: boolean = await eventExists(eventId);
		if (!isValidEvent) {
			return Promise.reject("EventNotFound");
		}
		const collection: Collection = client.db(Constants.EVENT_DB).collection(EventDB.METADATA);
		const event: ExpirationSchema = await collection.findOne({ id: eventId }) as ExpirationSchema;
		return Promise.resolve(Date.now() >= event.exp);
	} catch (error ){
		return Promise.reject(error);
	}
}

/**
 * Try to update the expiration time of an event.
 * @param eventId EventData struct containing the data to update.
 */
export async function updateExpiry(eventData: ExpirationFormat): Promise<void> {
	const collection: Collection = client.db(Constants.EVENT_DB).collection(EventDB.METADATA);
	await collection.updateOne({ id: eventData.id }, { $set: { exp: eventData.exp } }, { upsert: true });
	return;
}
