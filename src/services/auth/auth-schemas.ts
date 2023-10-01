import { Document, ObjectId, WithId } from "mongodb";
import { Provider } from "./auth-models.js";

// Auth roles schema
export interface RolesSchema extends WithId<Document> {
	_id: ObjectId,
	id: string,
	provider: Provider,
	roles: string[]
}

// Collections within the auth database
export enum AuthDB {
	ROLES = "roles",
}
