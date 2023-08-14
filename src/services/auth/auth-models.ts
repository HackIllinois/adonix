import { Document, ObjectId, WithId } from "mongodb";

import { Role } from "../../models.js";

export interface ProfileData {
	id: string,
	name: string,
	email: string,
}

export interface JwtPayload {
	id: string,
	email: string,
	provider: string,
	roles: Role[]
}

export enum Provider {
	GITHUB = "github",
	GOOGLE = "google",
}

// Newsletter document schema
export interface RolesSchema extends WithId<Document> {
	_id: ObjectId,
	id: string,
	provider: Provider,
	roles: string[]
}
