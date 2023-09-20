import { Document, ObjectId, WithId } from "mongodb";
import { PrivateEvent, PublicEvent } from "./event-models";

// Schema for each MongoDB
export interface PrivateEventSchema extends PrivateEvent, WithId<Document>{
	_id: ObjectId
}

export interface PublicEventSchema extends PublicEvent, WithId<Document> {
	_id: ObjectId
}
