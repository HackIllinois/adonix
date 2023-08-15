import "dotenv";
import { Collection, ObjectId} from "mongodb";
import jsonwebtoken, { SignOptions } from "jsonwebtoken";
import { RequestHandler } from "express-serve-static-core";
import passport, { AuthenticateOptions, Profile } from "passport";

import { Role } from "../../models.js";
import Constants from "../../constants.js";
import DatabaseHelper from "../../database.js";
import { RolesSchema } from "./auth-schemas.js";
import { JwtPayload, Provider, ProfileData, RoleOperation } from "./auth-models.js";


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


export async function getJwtPayload(provider: string, data: ProfileData): Promise<JwtPayload> {
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
	}).catch((error: Error) => {
		console.log("get function failed!");
		console.log(error);
	});

	// No roles found for user -> initialize them
	if (!payload.roles.length) {
		await initializeRoles(userId, provider as Provider, email).then((newRoles: Role[]) => {
			payload.roles = newRoles;
		}).catch((error: Error) => {
			console.log("get function failed!");
			console.log(error);
		});
	}

	return payload;
}


export function generateJwtToken(payload?: JwtPayload): string {
	if (!payload) {
		throw new Error("No JWT token passed in!");
	}

	// Ensure that the secret actually exists
	const secret: string | undefined = process.env.JWT_SECRET;
	if (!secret) {
		throw new Error("No secret provided for signing!");
	}

	// Appends an expiry field to the JWT token
	const options: SignOptions = {
		expiresIn: "7d",
	};

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


export async function getRoles(id: string): Promise<Role[]> {
	const collection: Collection = await DatabaseHelper.getCollection("auth", "roles");
	let roles: Role[] = [];
	
	try {
		// Get the roles for the user from the collection
		const userRoles: RolesSchema | null = await collection.findOne({ id: id }) as RolesSchema | null;
		
		// If roles are non-empty, modify the return list
		if (userRoles != null) {
			roles = userRoles.roles as Role[];
		}
	} catch {
		return Promise.reject("unable to connect to database!");
	}
	return roles;
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
