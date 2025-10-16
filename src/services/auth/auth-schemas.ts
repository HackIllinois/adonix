import { prop } from "@typegoose/typegoose";
import { z } from "zod";
import { UserIdSchema } from "../../common/schemas";
import { CreateErrorAndSchema } from "../../common/schemas";
import { SponsorEmailSchema } from "../sponsor/sponsor-schemas";
import { UserInfoSchema } from "../user/user-schemas";

export class AuthInfo {
    @prop({ required: true, index: true })
    public userId: string;

    @prop({ required: true })
    public provider: string;

    @prop({
        required: true,
        type: () => String,
    })
    public roles: string[];
}

export class AuthCode {
    @prop({ required: true })
    public email: string;

    @prop({ required: true })
    public code: string;

    @prop({ required: true })
    public expiry: number;
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
    SPONSOR = "sponsor",
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
export const RoleSchema = z.nativeEnum(Role).openapi("Role", { example: Role.USER });
export const RedirectUrlSchema = z.string().openapi("RedirectUrl", {
    example: "https://hackillinois.org/register",
    description: "Must be a valid HTTPS URL (or HTTP for localhost)",
});
export const SponsorLoginRequestSchema = z
    .object({
        email: SponsorEmailSchema,
        code: z.string().openapi({ example: "1A3Z56" }),
    })
    .openapi("SponsorLoginRequest");
export const ListUsersByRoleSchema = z
    .object({
        userIds: z.array(UserIdSchema),
    })
    .openapi("ListRoles");
export const ListUserInfoByRoleSchema = z
    .object({
        userInfo: z.array(UserInfoSchema),
    })
    .openapi("ListRolesInfo");
export const UserRolesSchema = z
    .object({
        id: UserIdSchema,
        roles: z.array(RoleSchema),
    })
    .openapi("Roles");
export const [AuthenticationFailedError, AuthenticationFailedErrorSchema] = CreateErrorAndSchema({
    error: "AuthenticationFailed",
    message: "Failed to authenticate (did the login session expire?) - please try again",
});
export const [BadRedirectUrlError, BadRedirectUrlErrorSchema] = CreateErrorAndSchema({
    error: "BadRedirectUrl",
    message: "The redirect url provided is invalid",
});
export const [BadCodeError, BadCodeErrorSchema] = CreateErrorAndSchema({
    error: "BadCode",
    message: "The code entered was invalid",
});
