import ms from "ms";
import jsonwebtoken, { SignOptions, TokenExpiredError } from "jsonwebtoken";
import { RequestHandler } from "express-serve-static-core";
import passport, { AuthenticateOptions, Profile } from "passport";

import Config, { PROD_DOMAIN } from "./config";

import { Role, JwtPayload, Provider, ProfileData, RoleOperation } from "../services/auth/auth-schemas";

import Models from "./models";
import { AuthInfo } from "../services/auth/auth-schemas";
import { UpdateQuery } from "mongoose";
import { IncomingMessage } from "http";
import StatusCode from "status-code-enum";
import { APIError } from "./schemas";
import { CookieOptions } from "express";

type AuthenticateFunction = (strategies: string | string[], options: AuthenticateOptions) => RequestHandler;
type VerifyCallback = (err: Error | null, user?: Profile | false, info?: object) => void;
type VerifyFunction = (accessToken: string, refreshToken: string, profile: Profile, done: VerifyCallback) => void;

export enum AuthenticationErrorType {
    TOKEN_EXPIRED,
    NO_TOKEN,
    TOKEN_INVALID,
}

const TYPE_TO_DETAILS = {
    [AuthenticationErrorType.TOKEN_EXPIRED]: {
        error: "TokenExpired",
        message: "Your session has expired, please log in again",
        status: StatusCode.ClientErrorForbidden,
    },
    [AuthenticationErrorType.NO_TOKEN]: {
        error: "NoToken",
        message: "A authorization token must be sent for this request",
        status: StatusCode.ClientErrorUnauthorized,
    },
    [AuthenticationErrorType.TOKEN_INVALID]: {
        error: "TokenInvalid",
        message: "Your session is invalid, please log in again",
        status: StatusCode.ClientErrorUnauthorized,
    },
};

export class AuthenticationError extends APIError<string, string> {
    constructor(type: AuthenticationErrorType) {
        const { error, message, status } = TYPE_TO_DETAILS[type];
        super(error, message, status);
    }
}

/**
 * Perform authentication step. Use this information to redirect to provider, perform auth, and then redirect user back to main website if successful or unsuccessful.
 * In the case of a failure, throw an error.
 * @param strategies List (or string) of valid authentication strategies for this route
 * @param options Set of options to be associated with these strategies
 * @returns Passport middleware that is used to perform authentication
 */
export const authenticateFunction: AuthenticateFunction = (strategies: string | string[], options: AuthenticateOptions) =>
    passport.authenticate(strategies, options, undefined) as RequestHandler;

/**
 * Simple function, used to verify that authentication actually happens correctly.
 * @param _1 Auth token - never used
 * @param _2 Refresh token - also never used
 * @param user Passport profile of the authenticated user - CHANGES based on strategy
 * @param callback Function to verify if the actual authentication step worked
 * @returns Results of the callback function, after it's been called with the user
 */
export const verifyFunction: VerifyFunction = (_1: string, _2: string, user: Profile, callback: VerifyCallback) =>
    // Data manipulation to store types of parsable inputs
    callback(null, user);

export function isValidRedirectUrl(url: string): boolean {
    let parsedUrl: URL;
    try {
        parsedUrl = new URL(url);
    } catch {
        return false;
    }

    // Allow mobile deep links
    if (parsedUrl.protocol === Config.MOBILE_DEEPLINK_PROTOCOL) {
        return true;
    }

    // Allow http for localhost
    if (parsedUrl.protocol !== "https:" && !(parsedUrl.protocol === "http:" && parsedUrl.hostname === "localhost")) {
        return false;
    }

    return Config.ALLOWED_CLIENT_HOSTS.some((redirectHost) => redirectHost.test(parsedUrl.hostname));
}

/**
 * Use the ProfileData to generate a payload object for JWT token (cast, extract relevant data, and return).
 * @param provider String of the provider, being used
 * @param data ProfileData, returned from passport post-authentication step
 * @param rawId boolean, true if the id in data needs to be prepended by the provider, false if not
 * @returns JwtPayload, which gets sent back to the user in the next step
 */
export async function getJwtPayloadFromProfile(provider: string, data: ProfileData, rawId: boolean): Promise<JwtPayload> {
    const userId: string = rawId ? `${provider}${data.id}` : `${data.id}`;
    const email: string = data.email;

    // Create payload object
    const payload: JwtPayload = {
        id: userId,
        email: email,
        provider: provider,
        roles: [],
    };

    // Get roles, and assign those to payload.roles if they exist. Next, update those entries in the database
    try {
        let oldRoles = await getRoles(userId);

        if (oldRoles === undefined) {
            oldRoles = [];
        }

        const newRoles: Role[] = initializeUserRoles(provider as Provider, data.email);
        payload.roles = [...new Set([...oldRoles, ...newRoles])];
        await updateUserRoles(userId, provider as Provider, payload.roles);
    } catch (error) {
        console.error(error);
    }

    return payload;
}

/**
 * Get a JWT payload for a user, from database. Perform an auth query and an users query, which are used in an implicit join.
 * @param targetUser UserID of the user to return a JWT payload for.
 * @returns Promise, containing either JWT payload or reason for failure
 */
export async function getJwtPayloadFromDB(targetUser: string): Promise<JwtPayload> {
    // Fill in auth info, used for provider and roles
    try {
        const authInfo = await Models.AuthInfo.findOne({ userId: targetUser });
        const userInfo = await Models.UserInfo.findOne({ userId: targetUser });

        if (!authInfo || !userInfo) {
            return Promise.reject("UserNotFound");
        }
        // Create and return new payload
        const newPayload: JwtPayload = {
            id: targetUser,
            roles: authInfo.roles as Role[],
            email: userInfo.email,
            provider: authInfo.provider,
        };

        return newPayload;
    } catch (error) {
        console.error(error);
    }

    return Promise.reject("UserNotFound");
}

/**
 * Gets options for a JWT authentication cookie with appropriate security settings.
 * For localhost, the domain is not set; for production, it uses the PROD_DOMAIN.
 *
 * @returns Options for the JWT cookie
 */
export function getJwtCookieOptions(): CookieOptions {
    const apiProd = Config.PROD;

    return {
        httpOnly: true,
        secure: apiProd,
        sameSite: apiProd ? "none" : "lax",
        path: "/",
        domain: apiProd ? PROD_DOMAIN : undefined,
        maxAge: ms(Config.DEFAULT_JWT_EXPIRY_TIME),
    };
}

/**
 * Create the token, assign an expiry date, and sign it
 * @param payload JWT payload to be included in the token
 * @param expiration Offset-based expiration. If not provided, defaults to 2 days.
 * @returns Signed JWT token, to be returned to the user.
 */
export function generateJwtToken(payload?: JwtPayload, shouldNotExpire?: boolean, expiration?: string): string {
    if (!payload) {
        throw new Error("No JWT token passed in!");
    }

    // Ensure that the secret actually exists
    const secret: string | undefined = Config.JWT_SECRET;
    if (!secret) {
        throw new Error("No secret provided for signing!");
    }

    // // Appends an expiry field to the JWT token
    const options: SignOptions = {};
    if (!shouldNotExpire) {
        const offset: number = ms(expiration ?? Config.DEFAULT_JWT_EXPIRY_TIME);
        payload.exp = Math.floor(Date.now() + offset) / Config.MILLISECONDS_PER_SECOND;
    }

    // Generate a token, and return it
    const token: string = jsonwebtoken.sign(payload, secret, options);
    return token;
}

/**
 * Ensure that a JWT token is a valid token. If invalid, throws an error.
 * @param token JWT token to decode
 * @returns Payload of the token if valid/
 */
export function decodeJwtToken(token?: string): JwtPayload {
    if (!token) {
        throw new AuthenticationError(AuthenticationErrorType.NO_TOKEN);
    }

    // Remove Bearer if included
    if (token.startsWith("Bearer ")) {
        token = token.substring("Bearer ".length);
    }

    // Verify already ensures that the token isn't expired. If it is, it returns an error
    try {
        return jsonwebtoken.verify(token, Config.JWT_SECRET) as JwtPayload;
    } catch (e) {
        // Handle errors by casting them to our type
        if (e instanceof TokenExpiredError) {
            throw new AuthenticationError(AuthenticationErrorType.TOKEN_EXPIRED);
        } else {
            throw new AuthenticationError(AuthenticationErrorType.TOKEN_INVALID);
        }
    }
}

/**
 * Gets the authenticated user from a request, errors if fails
 * @param req The request (should include cookies property for Express requests)
 * @returns User payload
 */
export function getAuthenticatedUser(
    req: IncomingMessage & { authorizationPayload?: JwtPayload; cookies?: Record<string, string> },
): JwtPayload {
    // Basic caching if we request the parsed jwt on the same request multiple times
    if (!req.authorizationPayload) {
        let token = req.headers.authorization;

        if (!token && req.cookies?.jwt) {
            token = req.cookies.jwt;
        }

        req.authorizationPayload = decodeJwtToken(token);
    }
    return req.authorizationPayload;
}

/**
 * Gets the authenticated user from a request, returns null if fails
 * @param req The request
 * @returns User payload
 */
export function tryGetAuthenticatedUser(req: IncomingMessage & { cookies?: Record<string, string> }): JwtPayload | null {
    try {
        return getAuthenticatedUser(req);
    } catch {
        return null;
    }
}

/**
 * Create an auth database entry for the current user. Should be called whenever a user is created.
 * @param id UserID to create the entry for
 * @param provider Provider being used to create this entry
 * @param roles Array of roles that belong to the given user
 * @returns Promise, containing nothing if valid. If invalid, error containing why.
 */
export async function updateUserRoles(id: string, provider: Provider, roles: Role[]): Promise<void> {
    // Create a new rolesEntry for the database, and insert it into the collection
    await Models.AuthInfo.findOneAndUpdate(
        { userId: id },
        { provider: provider.toLowerCase(), roles: roles },
        { upsert: true },
    ).catch((error) => error);
}

/**
 * Function to define the very basic user roles that a user should have before getting access.
 * @param provider Provider used to sign the user up
 * @param email Email address that the user signed up with
 * @returns List of roles that the uer containss
 */
export function initializeUserRoles(provider: Provider, email: string): Role[] {
    const roles: Role[] = [Role.USER];

    if (provider == Provider.GOOGLE) {
        if (!email.endsWith("@hackillinois.org")) {
            // Disallow any google emails that aren't hack
            return [];
        }
        // Otherwise, is staff, staff are also attendees
        roles.push(Role.ATTENDEE);
        roles.push(Role.STAFF);
        // If email in the system admin list, add the admin role
        if (Config.SYSTEM_ADMIN_LIST.includes(email.replace("@hackillinois.org", ""))) {
            roles.push(Role.ADMIN);
        }
    } else if (provider == Provider.SPONSOR) {
        roles.push(Role.SPONSOR);
    }

    return roles;
}

/**
 * Get auth database information for a given user
 * @param id UserID of the user to return the info for
 * @returns Promise containing user, provider, email, and roles if valid. If invalid, error containing why.
 */
export async function getAuthInfo(id: string): Promise<AuthInfo> {
    try {
        const info: AuthInfo | null = await Models.AuthInfo.findOne({ userId: id });

        // Null check to ensure that we're not returning anything null
        if (!info) {
            return Promise.reject("UserNotFound");
        }
        info.provider = info.provider.toLowerCase();

        return info;
    } catch {
        return Promise.reject("InternalError");
    }
}

export function generateCode(): string {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";

    for (let i = 0; i < Config.SPONSOR_CODE_LENGTH; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        code += characters[randomIndex];
    }

    return code;
}

/**
 * Calls the getAuthInfo function to get roles for a user. If the user does not exist, we return an empty array as opposed to an error.
 * @param id UserID of the user to return the info for
 * @returns Promise, containing array of roles for the user.
 */
export async function getRoles(id: string): Promise<Role[] | undefined> {
    return getAuthInfo(id)
        .then((authInfo) => authInfo.roles as Role[])
        .catch(() => undefined);
}

/**
 * Update the roles of a particular user within the database. CAN ONLY PERFORM ADD/REMOVE operations
 * @param userId ID of the user to update
 * @param role Role to add/remove
 * @param operation Operation to perform
 * @returns Promise - if valid, then update operation worked. If invalid, then contains why.
 */
export async function updateRoles(userId: string, role: Role, operation: RoleOperation): Promise<Role[] | undefined> {
    let updateQuery: UpdateQuery<AuthInfo>;

    // Get filter, representing operation to perform on mongoDB
    switch (operation) {
        case RoleOperation.ADD:
            updateQuery = { $addToSet: { roles: role } };
            break;
        case RoleOperation.REMOVE:
            updateQuery = { $pull: { roles: role } };
            break;
        default:
            return Promise.reject("OperationNotFound");
    }

    try {
        const updatedInfo: AuthInfo | null = await Models.AuthInfo.findOneAndUpdate({ userId: userId }, updateQuery, {
            new: true,
        });
        if (updatedInfo) {
            return updatedInfo.roles as Role[];
        } else {
            return undefined;
        }
    } catch (error) {
        return Promise.reject(error);
    }
}

/**
 * Get all id of users that have a particular role within the database.
 * @param role role that we want to filter for
 * @returns Promise<string[]> - if valid, then contains array of user w/ role. If invalid, then contains "Unknown Error".
 */
export async function getUsersWithRole(role: Role): Promise<string[]> {
    try {
        //Array of users as MongoDb schema that have role as one of its roles
        const queryResult: AuthInfo[] = await Models.AuthInfo.find({ roles: { $in: [role] } }).select("userId");
        return queryResult.map((user: AuthInfo) => user.userId);
    } catch (error) {
        return Promise.reject(error);
    }
}
