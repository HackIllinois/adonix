import { Document, ObjectId, WithId } from "mongodb";
import { EventMetadata, PublicEvent, StaffEvent } from "./event-models.js";

import { getModelForClass } from "@typegoose/typegoose";
import mongoose from "mongoose";
import { generateConfig } from "../../database.js";
import Constants from "../../constants.js";


export interface ExpirationSchema extends WithId<Document> {
	_id: ObjectId,
	exp: number,
}


// Collections within the event database
export enum EventDB {
	PUBLIC_EVENTS = "events",
	EVENT_CODES = "eventcodes",
	EVENT_TRACKERS = "eventtrackers",
	FAVORITES = "favorites",
	METADATA = "metadata",
	USER_TRACKERS = "usertrackers",
	STAFF_ATTENDANCE = "staffattendance",
	STAFF_EVENTS = "staffevents",
}


// Collections within the staff database
export enum StaffDB {
	ATTENDANCE = "attendance",
}

export const StaffEventModel: mongoose.Model<StaffEvent> = getModelForClass(StaffEvent, generateConfig(Constants.EVENT_DB, EventDB.STAFF_EVENTS));
export const PublicEventModel: mongoose.Model<PublicEvent> = getModelForClass(PublicEvent, generateConfig(Constants.EVENT_DB, EventDB.PUBLIC_EVENTS));
export const EventMetadataModel: mongoose.Model<EventMetadata> = getModelForClass(EventMetadata, generateConfig(Constants.EVENT_DB, EventDB.METADATA));
