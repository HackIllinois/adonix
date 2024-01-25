import z from "zod";

export interface ProfileData {
    id?: string;
    login?: string;
    email: string;
    displayName?: string;
    name?: string;
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

export const jwtValidator = z.object({
    /* eslint-disable-next-line no-magic-numbers */
    id: z.string().min(1),
    email: z.string().email(),
    /* eslint-disable-next-line no-magic-numbers */
    provider: z.string().min(1),
    roles: z.array(z.nativeEnum(Role)),
    exp: z.number().optional(),
});

export type JwtPayload = z.infer<typeof jwtValidator>;

export enum RoleOperation {
    ADD = "add",
    REMOVE = "remove",
}
