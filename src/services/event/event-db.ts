import { Document, ObjectId, WithId } from "mongodb";
import { PublicEvent, StaffEvent } from "./event-models";

import { getModelForClass } from "@typegoose/typegoose";
import mongoose from "mongoose";
import { connectToMongoose } from "src/database";
import Constants from "src/constants";


export interface ExpirationSchema extends WithId<Document> {
	_id: ObjectId,
	exp: number,
}


// Collections within the event database
export enum EventDB {
	ATTENDEE_EVENTS = "staffevents",
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


const staffDatabase: mongoose.Connection = connectToMongoose(Constants.EVENT_DB);
const publicDatabase: mongoose.Connection = connectToMongoose(Constants.EVENT_DB);

export const StaffEventModel = getModelForClass(StaffEvent, {existingConnection: staffDatabase});
export const PublicEventModel = getModelForClass(PublicEvent, {existingConnection: publicDatabase});
