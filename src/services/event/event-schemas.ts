import { Document, ObjectId, WithId } from "mongodb";
import { InternalEvent, ExternalEvent } from "./event-models";

// Schema for each MongoDB
export interface InternalEventSchema extends InternalEvent, WithId<Document> {
	_id: ObjectId
}

export interface ExternalEventSchema extends ExternalEvent, WithId<Document> {
	_id: ObjectId
}

export interface ExpirationSchema extends WithId<Document> {
	_id: ObjectId,
	exp: number,
}

// Collections within the "event" database
export enum EventDB {
	ATTENDEE_EVENTS = "events",
	EVENT_CODES = "eventcodes",
	EVENT_TRACKERS = "eventtrackers",
	EXPIRATIONS="expirations",
	FAVORITES = "favorites",
	USER_TRACKERS = "usertrackers",
	STAFF_ATTENDANCE = "staffattendance",
	STAFF_EVENTS = "staffevents",
}

// Collections within the staff database
export enum StaffDB {
	ATTENDANCE = "attendance",
}
