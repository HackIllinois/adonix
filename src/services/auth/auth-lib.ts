import "dotenv";
import ms from "ms";
import { Collection, ObjectId} from "mongodb";
import jsonwebtoken, { SignOptions } from "jsonwebtoken";
import { RequestHandler } from "express-serve-static-core";
import passport, { AuthenticateOptions, Profile } from "passport";

import { Role } from "../../models.js";
import Constants from "../../constants.js";
import DatabaseHelper from "../../database.js";


import { RolesSchema } from "./auth-schemas.js";
import { JwtPayload, Provider, ProfileData, RoleOperation } from "./auth-models.js";

import { UserSchema } from "../user/user-schemas.js";
import { getUser } from "../user/user-lib.js";


type AuthenticateFunction = (strategies: string | string[], options: AuthenticateOptions) => RequestHandler;
type VerifyCallback = (err: Error | null, user?: Profile | false, info?: object) => void;
type VerifyFunction = (accessToken: string, refreshToken: string, profile: Profile, done: VerifyCallback) => void;


// Function that returns a RequestHandler based on the strategies and options passed in
export const authenticateFunction: AuthenticateFunction = (strategies: string | string[], options: AuthenticateOptions) => {
	return passport.authenticate(strategies, options, undefined) as RequestHandler;
};


// Do-Nothing function to be used in OAuth strategies
export const verifyFunction: VerifyFunction = (_1: string, _2: string, user: Profile, callback: VerifyCallback) => {
	return callback(null, user);
};


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
	await getRoles(userId).then((userRoles: Role[]) => {
		if (userRoles.length) {
			payload.roles = userRoles;
		}
	}).catch((error: string) => {
		console.log("get function failed inside getRoles!");
		console.log(error);
	});

	// No roles found for user -> initialize them
	if (!payload.roles.length) {
		await initializeRoles(userId, provider as Provider, email).then((newRoles: Role[]) => {
			payload.roles = newRoles;
		}).catch((error: string) => {
			console.log("get function failed inside initializeRoles!");
			console.log(error);
		});
	}

	return payload;
}


export async function getJwtPayloadFromDB(targetUser: string): Promise<JwtPayload> {
	let authInfo: RolesSchema | undefined;
	let userInfo: UserSchema | undefined;

	// Fill in auth info, used for provider and roles
	await getAuthInfo(targetUser).then((info: RolesSchema) => {
		authInfo = info;
	}).catch((error: string) => {
		console.log(error);
	});

	// Fill in user info, used for email
	await getUser(targetUser).then((info: UserSchema) => {
		userInfo = info;
	}).catch((error: string) => {
		console.log(error);
	});

	// If either one does not exist, the info doesn't exist in the database. Throw error
	if (!authInfo || !userInfo) {
		return Promise.reject("Unable to get info from database!");
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
	console.log(payload.exp);

	// Generate a token, and return it
	const token: string = jsonwebtoken.sign(payload, secret, options);
	return token;
}


export function decodeJwtToken(token?: string): JwtPayload {
	if (!token) {
		throw new Error("no token provided!");
	}

	// Ensure that we have a secret to parse token
	const secret: string | undefined = process.env.JWT_SECRET;
	if (!secret) {
		throw new Error("no secret to parse JWT token!");
	}

	// Verify already ensures that the token isn't expired. If it is, it returns an error
	return jsonwebtoken.verify(token, secret) as JwtPayload;
}


export async function initializeRoles(id: string, provider: Provider, email: string): Promise<Role[]> {
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

	// Create a new rolesEntry for the database, and insert it into the collection
	const newUser: RolesSchema = {_id: new ObjectId(), id: id, provider: provider, roles: roles};
	const collection: Collection = await DatabaseHelper.getCollection("auth", "roles");
	await collection.insertOne(newUser);

	return roles;
}


export async function getAuthInfo(id: string): Promise<RolesSchema> {
	const collection: Collection = await DatabaseHelper.getCollection("auth", "roles");

	try {
		const info: RolesSchema | null = await collection.findOne({id: id}) as RolesSchema | null;

		// Null check to ensure that we're not returning anything null
		if (!info) {
			console.log("rejecting...");
			return Promise.reject("User ID does not exist in the database!");
		}

		return info;
	} catch {
		return Promise.reject("Unable to get data from the database!");
	}
}


export async function getRoles(id: string): Promise<Role[]> {
	let roles: Role[] | undefined;
	// Call helper function to get auth info, and just return data from there
	await getAuthInfo(id).then((user: RolesSchema) => {
		roles = user.roles as Role[];
	}).catch((error: string) => {
		return Promise.reject(error);
	});

	return roles ?? Promise.reject("Unknown error!");
}


export async function updateRoles(userId: string, role: Role, operation: RoleOperation): Promise<void> {
	let filter: Partial<RolesSchema> | undefined;

	// Get filter, representing operation to perform on mongoDB
	switch (operation) {
	case RoleOperation.ADD: filter = {"$addToSet": {"roles": role}}; break;
	case RoleOperation.REMOVE: filter = {"$pull": {"roles": role}}; break;
	default: return Promise.reject("no valid operation passed in");
	}

	// Appoly filter to roles collection, based on the operation
	const collection: Collection = await DatabaseHelper.getCollection("auth", "roles");
	await collection.updateOne({id: userId}, filter);
	return Promise.resolve();
}


// Check if a user is an ADMIN or a STAFF
export function hasElevatedPerms(payload: JwtPayload): boolean {
	const roles: Role[] = payload.roles;
	return roles.includes(Role.ADMIN) || roles.includes(Role.STAFF);
}
