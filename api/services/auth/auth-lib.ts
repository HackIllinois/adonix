import "dotenv";
import passport, { AuthenticateOptions, Profile } from "passport";
import jsonwebtoken, { SignOptions } from "jsonwebtoken";
import { Collection, InsertOneResult, ObjectId } from "mongodb";

import { RequestHandler } from "express-serve-static-core";
import { Role } from "../../models.js";

import DatabaseHelper from "../../database.js";
import { JwtPayload, Provider, RolesSchema, ProfileData } from "./auth-models.js";


type AuthenticateFunction = (strategies: string | string[], options: AuthenticateOptions) => RequestHandler;
type VerifyCallback = (err: Error | null, user?: Profile | false, info?: object) => void;
type VerifyFunction = (accessToken: string, refreshToken: string, profile: Profile, done: VerifyCallback) => void;


export const authenticateFunction: AuthenticateFunction = (strategies: string | string[], options: AuthenticateOptions) => {
	return passport.authenticate(strategies, options, undefined) as RequestHandler;
};


export const verifyFunction: VerifyFunction = (_1: string, _2: string, user: Profile, callback: VerifyCallback) => {
	return callback(null, user);
};


export function getJwtPayload(provider: string, data: ProfileData): JwtPayload {
	const userId: string = provider + data.id;

	const payload: JwtPayload = {
		id: userId,
		email: data.email,
		provider: provider,
		roles: [],
	};

	// IIFE function to get roles - breaks async/await cycle and blocks until we get the results
	(async (): Promise<void> => {
		await getRoles(userId, provider as Provider).then((userRoles: Role[]) => {
			payload.roles = userRoles;
		});
	});

	return payload;
}


export function generateJwtToken(payload: JwtPayload): string {
	const secret: string | undefined = process.env.JWT_SECRET;

	if (!secret) {
		throw new Error("no secret provided for signing!");
	}

	const options: SignOptions = {
		// algorithm: "ES256",
		expiresIn: "7d",
	};

	const token: string = jsonwebtoken.sign(payload, secret, options);
	return token;
}

export function initializeRoles(provider: Provider): Role[] {
	const roles: Role[] = [];

	if (provider == Provider.GOOGLE) {
		roles.push(Role.STAFF);
	}

	return roles;
}

export async function getRoles(id: string, provider: Provider): Promise<Role[]> {
	const collection: Collection = await DatabaseHelper.getCollection("auth", "roles");
	console.log("in get roles! %s", id);
	let roles: Role[] = [];

	try {
		const userRoles: RolesSchema | null = await collection.findOne({ id: id }) as RolesSchema | null;
		if (userRoles == null) {
			console.log("user not found! inserting");
			roles = initializeRoles(provider);
			const newUser: RolesSchema = { _id: new ObjectId(), id: id, provider: provider, roles: roles };
			const insertResult: InsertOneResult = await collection.insertOne(newUser);
			console.log(insertResult);
		} else {
			roles = userRoles.roles as Role[];
		}
	} catch {
		return Promise.reject("unable to connect to database!");
	}

	return roles;
}
