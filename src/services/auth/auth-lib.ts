import "dotenv";
import ms from "ms";
import { Collection, ObjectId, Filter, Document } from "mongodb";
import jsonwebtoken, { SignOptions } from "jsonwebtoken";
import { RequestHandler } from "express-serve-static-core";
import passport, { AuthenticateOptions, Profile } from "passport";

import Constants from "../../constants.js";
import databaseClient from "../../database.js";

import { AuthDB, RolesSchema } from "./auth-schemas.js";
import { Role, JwtPayload, Provider, ProfileData, RoleOperation } from "./auth-models.js";

import { UserSchema } from "../user/user-schemas.js";
import { getUser } from "../user/user-lib.js";

type AuthenticateFunction = (strategies: string | string[], options: AuthenticateOptions) => RequestHandler;
type VerifyCallback = (err: Error | null, user?: Profile | false, info?: object) => void;
type VerifyFunction = (accessToken: string, refreshToken: string, profile: Profile, done: VerifyCallback) => void;


/**
 * Perform authentication step. Use this information to redirect to provider, perform auth, and then redirect user back to main website if successful or unsuccessful.
 * In the case of a failure, throw an error.
 * @param strategies List (or string) of valid authentication strategies for this route
 * @param options Set of options to be associated with these strategies
 * @returns Passport middleware that is used to perform authentication
 */
export const authenticateFunction: AuthenticateFunction = (strategies: string | string[], options: AuthenticateOptions) => {
	return passport.authenticate(strategies, options, undefined) as RequestHandler;
};


/**
 * Simple function, used to verify that authentication actually happens correctly.
 * @param _1 Auth token - never used
 * @param _2 Refresh token - also never used
 * @param user Passport profile of the authenticated user - CHANGES based on strategy
 * @param callback Function to verify if the actual authentication step worked
 * @returns Results of the callback function, after it's been called with the user
 */
export const verifyFunction: VerifyFunction = (_1: string, _2: string, user: Profile, callback: VerifyCallback) => {
	// Data manipulation to store types of parsable inputs
	return callback(null, user);
};


/**
 * Use the ProfileData to generate a payload object for JWT token (cast, extract relevant data, and return).
 * @param provider String of the provider, being used
 * @param data ProfileData, returned from passport post-authentication step
 * @returns JwtPayload, which gets sent back to the user in the next step
 */
export async function getJwtPayloadFromProfile(provider: string, data: ProfileData): Promise<JwtPayload> {
	const userId: string = provider + data.id;
	const email: string = data.email;

	// Create payload object
	const payload: JwtPayload = {
		id: userId,
		email: email,
		provider: provider,
		roles: [],
	};

	// Get roles, and assign those to payload.roles if they exist
	try {
		let roles: Role[] = await getRoles(userId);

		// If roles don't exist already - initialize them for the user, and return the new set of roles
		if (!roles.length) {
			roles = await initializeRoles(userId, provider.toUpperCase() as Provider, email);
		}
		payload.roles = roles;
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

	let authInfo: RolesSchema | undefined;
	let userInfo: UserSchema | undefined;

	// Fill in auth info, used for provider and roles



	try {
		authInfo = await getAuthInfo(targetUser);
		userInfo = await getUser(targetUser);
		

	} catch (error) {
		console.error(error);
	}
		
	// If either one does not exist, the info doesn't exist in the database. Throw error
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
}

/**
 * Create the token, assign an expiry date, and sign it
 * @param payload JWT payload to be included in the token
 * @param expiration Offset-based expiration. If not provided, defaults to 2 days.
 * @returns Signed JWT token, to be returned to the user.
 */
export function generateJwtToken(payload?: JwtPayload, expiration?: string): string {
	if (!payload) {
		throw new Error("No JWT token passed in!");
	}

	// Ensure that the secret actually exists
	const secret: string | undefined = process.env.JWT_SECRET;
	if (!secret) {
		throw new Error("No secret provided for signing!");
	}

	// // Appends an expiry field to the JWT token
	const options: SignOptions = { };
	const offset: number = ms(expiration ?? Constants.DEFAULT_JWT_OFFSET);
	payload.exp = Math.floor(Date.now() + offset) / Constants.MILLISECONDS_PER_SECOND;

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
		throw new Error("NoToken");
	}

	// Ensure that we have a secret to parse token
	const secret: string | undefined = process.env.JWT_SECRET;
	if (!secret) {
		throw new Error("NoSecret");
	}

	// Verify already ensures that the token isn't expired. If it is, it returns an error
	return jsonwebtoken.verify(token, secret) as JwtPayload;
}


/**
 * Create an auth database entry for the current user. Should be called whenever a user is created.
 * @param id UserID to create the entry for
 * @param provider Provider being used to create this entry
 * @param email Email address of current user
 * @returns Promise, containing list of user roles if valid. If invalid, error containing why.
 */
export async function initializeRoles(id: string, provider: Provider, email: string): Promise<Role[]> {
	const roles: Role[] = defineUserRoles(provider, email);

	// Create a new rolesEntry for the database, and insert it into the collection
	const newUser: RolesSchema = { _id: new ObjectId(), id: id, provider: provider, roles: roles };
	const collection: Collection = databaseClient.db(Constants.AUTH_DB).collection(AuthDB.ROLES);
	await collection.insertOne(newUser);

	return roles;
}


/**
 * Function to define the very basic user roles that a user should have before getting access.
 * @param provider Provider used to sign the user up
 * @param email Email address that the user signed up with
 * @returns List of roles that the uer containss
 */
export function defineUserRoles(provider: Provider, email: string): Role[] {
	const roles: Role[] = [];

	// Check if this is a staff email
	if (provider == Provider.GOOGLE && email.endsWith("@hackillinois.org")) {
		roles.push(Role.STAFF);
		// If email in the system admin list, add the admin role
		if (Constants.SYSTEM_ADMIN_LIST.includes(email.replace("@hackillinois.org", ""))) {
			roles.push(Role.ADMIN);
		}
	}

	// Add the basic USER role in the provider
	if (provider == Provider.GITHUB) {
		roles.push(Role.USER);
	}

	return roles;
}


/**
 * Get auth database information for a given user
 * @param id UserID of the user to return the info for
 * @returns Promise containing user, provider, email, and roles if valid. If invalid, error containing why.
 */
export async function getAuthInfo(id: string): Promise<RolesSchema> {
	const collection: Collection = databaseClient.db(Constants.AUTH_DB).collection(AuthDB.ROLES);

	try {
		const info: RolesSchema | null = await collection.findOne({ id: id }) as RolesSchema | null;

		// Null check to ensure that we're not returning anything null
		if (!info) {
			return Promise.reject("UserNotFound");
		}

		return info;
	} catch {
		return Promise.reject("InternalError");
	}
}


/**
 * Calls the getAuthInfo function to get roles for a user
 * @param id UserID of the user to return the info for
 * @returns Promise, containing array of roles for the user.
 */
export async function getRoles(id: string): Promise<Role[]> {
	let roles: Role[] | undefined;
	// Call helper function to get auth info, and return data from there
	await getAuthInfo(id).then((user: RolesSchema) => {
		roles = user.roles as Role[];
	}).catch((error: string) => {
		return Promise.reject(error);
	});

	return roles ?? Promise.reject("UserNotFound");
}


/**
 * Update the roles of a particular user within the database. CAN ONLY PERFORM ADD/REMOVE operations
 * @param userId ID of the user to update
 * @param role Role to add/remove
 * @param operation Operation to perform
 * @returns Promise - if valid, then update operation worked. If invalid, then contains why.
 */
export async function updateRoles(userId: string, role: Role, operation: RoleOperation): Promise<void> {
	let filter: Partial<RolesSchema> | undefined;

	// Get filter, representing operation to perform on mongoDB
	switch (operation) {
	case RoleOperation.ADD: filter = { "$addToSet": { "roles": role } }; break;
	case RoleOperation.REMOVE: filter = { "$pull": { "roles": role } }; break;
	}

	// Apply filter to roles collection, based on the operation
	const collection: Collection = databaseClient.db(Constants.AUTH_DB).collection(AuthDB.ROLES);
	await collection.updateOne({ id: userId }, filter);
}


/**
 * Catch-all function to check if a user should have permissions to perform operations on attendees
 * @param payload Payload of user performing the actual request
 * @returns True if the user is an ADMIN or a STAFF, else false
 */
export function hasElevatedPerms(payload: JwtPayload): boolean {
	return hasStaffPerms(payload) || hasAdminPerms(payload);
}


/**
 * Check if a user has permissions to perform staff operations
 * @param payload Payload of user performing the actual request
 * @returns True if the user is a STAFF, else false
 */

export function hasStaffPerms(payload?: JwtPayload): boolean {
	if (!payload) {
		return false;
	}

	return payload.roles.includes(Role.STAFF);
}


/**
 * Check if a user has permissions to perform admin operations
 * @param payload Payload of user performing the actual request
 * @returns True if the user is an ADMIN, else false
 */
export function hasAdminPerms(payload?: JwtPayload): boolean {
	if (!payload) {
		return false;
	}

	return payload.roles.includes(Role.ADMIN);
}

/**
 * Given a string of the format device=DEVICENAME, verify that the string is actually valid and contains a device name.
 * @param k Key-value pair, representing the parameter.
 * @returns Device type if valid, else throws an error
 */
export function getDevice(kv?: string): string {
	if (!kv) {
		throw new Error("NoInput");
	}


	// Replace everything before/after the first equal with nothing, to get KV pairs
	const key: string = kv.replace(/=.*/, "");
	const value: string = kv.replace(/.*=/, "");

	if (!key || key != "device") {
		throw new Error("NoKey");
	}

	if (!value || !Constants.REDIRECT_MAPPINGS.has(value) ) {
		throw new Error("NoValue");
	}

	return value;
}


/**
 * Get all id of users that have a particular role within the database.
 * @param role role that we want to filter for
 * @returns Promise<string[]> - if valid, then contains array of user w/ role. If invalid, then contains "Unknown Error".
 */
export async function getUsersWithRole(role : string): Promise<string[]> {

	// Makes a reference to the roles collection
	const collection: Collection = databaseClient.db(Constants.AUTH_DB).collection(AuthDB.ROLES);

	//Makes a mongodb query that iterates through the roles array for each user and selects ones that have wanted role
	const queryCriteria : Filter<Document> = { roles: { $in: [role] } };

	//Array of users as MongoDb schema that have role as one of its roles
	const result : RolesSchema[] = await collection.find(queryCriteria).toArray() as RolesSchema[];
	//Array of strings for id, will be the return value of this funciton
	const idArray : string[] = result.map((user : RolesSchema) => {
		return user.id;
	});

	return idArray ?? Promise.reject("Unknown Error");
}
