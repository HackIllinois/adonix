import { Document, ObjectId, WithId } from "mongodb";
import { PrivateEvent, PublicEvent } from "./event-models";

// Schema for each MongoDB
export interface PrivateEventSchema extends PrivateEvent, WithId<Document> {
	_id: ObjectId
}

export interface PublicEventSchema extends PublicEvent, WithId<Document> {
	_id: ObjectId
}

// Collections within the "event" database
export enum EventDB {
	EVENT_CODES = "eventcodes",
	EVENTS = "events",
	EVENT_TRACKERS = "eventtrackers",
	FAVORITES = "favorites",
	USER_TRACKERS = "usertrackers",
}

// Collections within the staff database
export enum StaffDB {
	ATTENDANCE = "attendance",
}
