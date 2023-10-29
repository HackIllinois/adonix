export interface ProfileData {
    id?: string;
    login?: string;
    email: string;
    displayName?: string;
    name?: string;
}

export interface JwtPayload {
    id: string;
    email: string;
    provider: string;
    roles: Role[];
    exp?: number;
}

export enum Role {
    ADMIN = "ADMIN",
    STAFF = "STAFF",
    MENTOR = "MENTOR",
    APPLICANT = "APPLICANT",
    ATTENDEE = "ATTENDEE",
    USER = "USER",
    SPONSOR = "SPONSOR",
    BLOBSTORE = "BLOBSTORE",
}

export enum Provider {
    GITHUB = "github",
    GOOGLE = "google",
}

export enum RoleOperation {
    ADD = "add",
    REMOVE = "remove",
}
