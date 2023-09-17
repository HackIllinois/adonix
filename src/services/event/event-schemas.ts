import { Document, ObjectId, WithId } from "mongodb";
import { BaseEvent } from "./event-models";

// Schema for each MongoDB
export interface EventSchema extends BaseEvent, WithId<Document>{
	_id: ObjectId
}
