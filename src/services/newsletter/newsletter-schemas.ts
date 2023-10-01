import { Document, ObjectId, WithId } from "mongodb";


// Newsletter document schema
export interface NewsletterSchema extends WithId<Document> {
	_id: ObjectId,
	listName: string,
	subscribers: string[]
}

// Collections within the newsletter database
export enum NewsletterDB {
	NEWSLETTERS = "newsletters"
}
