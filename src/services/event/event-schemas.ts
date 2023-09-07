import { Document, ObjectId, WithId } from "mongodb";
import { UnfilteredEvent } from "./event-models";

// Schema for each MongoDB
export interface EventSchema extends UnfilteredEvent, WithId<Document>{
	_id: ObjectId
}
