import { Document, ObjectId, WithId } from "mongodb";
import { Event } from "./event-models";

// Schema for each MongoDB 
export interface EventSchema extends Event, WithId<Document>{
	_id: ObjectId
};
