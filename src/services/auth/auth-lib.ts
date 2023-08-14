import "dotenv";
import { Collection, ObjectId, UpdateFilter } from "mongodb";
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


export const authenticateFunction: AuthenticateFunction = (strategies: string | string[], options: AuthenticateOptions) => {
	return passport.authenticate(strategies, options, undefined) as RequestHandler;
};


export const verifyFunction: VerifyFunction = (_1: string, _2: string, user: Profile, callback: VerifyCallback) => {
	return callback(null, user);
};


export async function getJwtPayload(provider: string, data: ProfileData): Promise<JwtPayload> {
	const userId: string = provider + data.id;
	const email: string = data.email;

	const payload: JwtPayload = {
		id: userId,
		email: email,
		provider: provider,
		roles: [],
	};

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

	const secret: string | undefined = process.env.JWT_SECRET;

	if (!secret) {
		throw new Error("No secret provided for signing!");
	}

	const options: SignOptions = {
		expiresIn: "7d",
	};

	const token: string = jsonwebtoken.sign(payload, secret, options);
	return token;
}


export function decodeJwtToken(token?: string): JwtPayload {
	if (!token) {
		throw new Error("no token provided!");
	}

	const secret: string | undefined = process.env.JWT_SECRET;
	if (!secret) {
		throw new Error("no secret to parse JWT token!");
	}

	return jsonwebtoken.verify(token, secret) as JwtPayload;
}


export async function initializeRoles(id: string, provider: Provider, email: string): Promise<Role[]> {
	const roles: Role[] = [];

	if (provider == Provider.GOOGLE && email.endsWith("@hackillinois.org")) {
		roles.push(Role.STAFF);
		if (Constants.SYSTEM_ADMIN_LIST.includes(email.replace("@hackillinois.org", ""))) {
			roles.push(Role.ADMIN);
		}
	}

	if (provider == Provider.GITHUB) {
		roles.push(Role.USER);
	}


	const newUser: RolesSchema = {_id: new ObjectId(), id: id, provider: provider, roles: roles};
	const collection: Collection = await DatabaseHelper.getCollection("auth", "roles");
	await collection.insertOne(newUser);

	return roles;
}


export async function getRoles(id: string): Promise<Role[]> {
	const collection: Collection = await DatabaseHelper.getCollection("auth", "roles");
	let roles: Role[] = [];
	
	try {
		const userRoles: RolesSchema | null = await collection.findOne({ id: id }) as RolesSchema | null;
		if (userRoles != null) {
			roles = userRoles.roles as Role[];
		}
	} catch {
		return Promise.reject("unable to connect to database!");
	}
	return roles;
}


export async function updateRoles(userId: string, role: Role, operation: RoleOperation): Promise<void> {
	var op: string = "";

	if (operation == RoleOperation.ADD) {
		op = "$addToSet";
	} 

	if (operation == RoleOperation.REMOVE) {
		op = "$pull";
	}

	const collection: Collection = await DatabaseHelper.getCollection("auth", "roles");
	const filter: Partial<RolesSchema> = {op: {"roles": role}};
	await collection.updateOne({id: userId}, filter);
	return Promise.resolve();
}


export function hasElevatedPerms(payload: JwtPayload): boolean {
	const roles: Role[] = payload.roles;
	return roles.includes(Role.ADMIN) || roles.includes(Role.STAFF);
}
