import { Role } from "../../models.js";

export interface ProfileData {
	id?: string,
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

export enum RoleOperation {
	ADD = "add",
	REMOVE = "remove",
}
