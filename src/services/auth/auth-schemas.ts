import { prop } from "@typegoose/typegoose";
import { z } from "zod";
import { Device } from "../../common/config";
import { UserIdSchema } from "../user/user-schemas";
import { CreateErrorAndSchema } from "../../common/schemas";

export class AuthInfo {
    @prop({ required: true })
    public userId: string;

    @prop({ required: true })
    public provider: string;

    @prop({
        required: true,
        type: () => String,
    })
    public roles: string[];
}

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
    PRO = "PRO",
}

export enum Provider {
    GITHUB = "github",
    GOOGLE = "google",
}

export enum RoleOperation {
    ADD = "add",
    REMOVE = "remove",
}

// PUT Request format for adding and removing roles
export interface ModifyRoleRequest {
    id: string;
    role: string;
}

export const ProviderSchema = z.nativeEnum(Provider).openapi("Provider", {
    description: "The provider to use for authentication. Attendees use GitHub and staff use Google.",
    example: Provider.GITHUB,
});
export const DeviceSchema = z.nativeEnum(Device).openapi("Device", { example: Device.WEB });
export const RoleSchema = z.nativeEnum(Role).openapi("Role", { example: Role.USER });
export const JWTSchema = z.string().openapi("JWT", {
    example: "eyJ.eyJ.3QuKc",
});

export const AuthDevSchema = z.object({
    Authorization: JWTSchema,
});
export const ListUsersByRoleSchema = z
    .object({
        userIds: z.array(UserIdSchema),
    })
    .openapi("ListRoles");
export const UserRolesSchema = z
    .object({
        id: UserIdSchema,
        roles: z.array(RoleSchema),
    })
    .openapi("Roles");
export const RefreshTokenSchema = z
    .object({
        token: JWTSchema,
    })
    .openapi("RefreshToken");

export const [AuthorizationFailedError, AuthorizationFailedErrorSchema] = CreateErrorAndSchema({
    error: "AuthorizationFailed",
    message: "Failed to authenticate",
});
