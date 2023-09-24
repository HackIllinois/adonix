export interface ProfileData {
	id?: string,
	email: string,
}

export interface JwtPayload {
	id: string,
	email: string,
	provider: string,
	roles: Role[],
	exp?: number
}

export enum Role {
	ADMIN = "Admin",
	STAFF = "Staff",
	MENTOR = "Mentor",
	APPLICANT = "Applicant",
	ATTENDEE = "Attendee",
	USER = "User",
	SPONSOR = "Sponsor",
	BLOBSTORE = "Blobstore",
}

export enum Provider {
	GITHUB = "github",
	GOOGLE = "google",
}

export enum RoleOperation {
	ADD = "add",
	REMOVE = "remove",
}
