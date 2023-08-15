import { Document, ObjectId, WithId } from "mongodb";

// User object document schema
export interface UserSchema extends WithId<Document> {
	_id: ObjectId,
	id: string,
	firstName: string,
	lastName: string,
	email: string
}
