import "dotenv";
import passport from "passport";
import { NextFunction } from "express-serve-static-core";
import express, { Request, Response, Router } from "express";
import GitHubStrategy, { Profile as GithubProfile } from "passport-github";
import { Profile as GoogleProfile, Strategy as GoogleStrategy } from "passport-google-oauth20";

import { Role } from "../../models.js";
import Constants from "../../constants.js";
import { SelectAuthProvider } from "../../middleware/select-auth.js";
import { JwtPayload, ProfileData, Provider, RoleOperation } from "./auth-models.js";
import { decodeJwtToken, generateJwtToken, getJwtPayload, getRoles, hasElevatedPerms, updateRoles, verifyFunction } from "./auth-lib.js";
import { ModifyRoleRequest } from "./auth-formats.js";


passport.use(Provider.GITHUB, new GitHubStrategy({
	clientID: process.env.GITHUB_OAUTH_ID ?? "",
	clientSecret: process.env.GITHUB_OAUTH_SECRET ?? "",
	callbackURL: Constants.GITHUB_OAUTH_CALLBACK,
}, verifyFunction));


passport.use(Provider.GOOGLE, new GoogleStrategy({
	clientID: process.env.GOOGLE_OAUTH_ID ?? "",
	clientSecret: process.env.GOOGLE_OAUTH_SECRET ?? "",
	callbackURL: Constants.GOOGLE_OAUTH_CALLBACK,
}, verifyFunction));


const authRouter: Router = Router();
authRouter.use(express.urlencoded({ extended: false }));


authRouter.get("/test/", (_: Request, res: Response) => {
	console.log("Received log!");
	res.end("Auth endpoint is working!");
});


authRouter.get("/github/", SelectAuthProvider("github"));


authRouter.get("/google/", SelectAuthProvider("google"));


authRouter.get("/:PROVIDER/callback/", (req: Request, res: Response, next: NextFunction) => {
	const provider: string = req.params.PROVIDER ?? "";
	SelectAuthProvider(provider)(req, res, next);
}, async (req: Request, res: Response) => {
	// Throw unauthorized if request isn't authenticated
	if (!req.isAuthenticated()) {
		res.status(Constants.UNAUTHORIZED_REQUEST).send();
	}

	// Data manipulation to store types of parsable inputs
	const user: GithubProfile | GoogleProfile = req.user as GithubProfile | GoogleProfile;
	const data: ProfileData = user._json as ProfileData;
	data.id = data.id ?? user.id;
	let payload: JwtPayload | undefined = undefined;
	
	// Load in the payload with the actual values stored in the database
	await getJwtPayload(user.provider, data).then( (parsedPayload: JwtPayload) => {
		payload = parsedPayload;
	}).catch( (error: Error) => {
		res.status(Constants.BAD_REQUEST).send(error);
	});

	// Generate the token, and return it
	const token: string = generateJwtToken(payload);
	res.status(Constants.SUCCESS).send({ token: token });
});


authRouter.get("/roles/:USERID", async (req: Request, res: Response) => {
	const targetUser: string | undefined = req.params.USERID;

	// Check if we have a user to get roles for - if not, get roles for current user
	if (!targetUser) {
		res.redirect("/auth/roles/");
		return;
	}

	try {
		const payload: JwtPayload = decodeJwtToken(req.headers.authorization);

		// Cases: Target user already logged in, auth user is admin
		if (payload.id == targetUser) {
			res.status(Constants.SUCCESS).send({id: payload.id, roles: payload.roles});
		} else if (hasElevatedPerms(payload)) {
			let roles: Role[] = [];
			await getRoles(targetUser).then((targetRoles: Role[]) => {
				roles = targetRoles;
			}).catch((error: Error) => {
				throw error;
			});
			console.log(roles);
			res.status(Constants.SUCCESS).send({id: targetUser, roles: roles});
		} else {
			res.status(Constants.FORBIDDEN).send("not authorized to perform this operation!");
		}
	} catch (error) {
		res.status(Constants.FORBIDDEN).send(error);
	}
});


authRouter.put("/roles/:OPERATION/", async (req: Request, res: Response) => {
	// Parse to get operation type
	const op: RoleOperation | undefined = RoleOperation[req.params.operation as keyof typeof RoleOperation];

	// No operation - fail out
	if (!op) {
		res.status(Constants.BAD_REQUEST).send({error: "operation not specified!"});
		return;
	}

	try {
		const payload: JwtPayload = decodeJwtToken(req.headers.authorization);

		// Not authenticated with modify roles perms
		if (!hasElevatedPerms(payload)) {
			res.status(Constants.FORBIDDEN).send({error: "not permitted to modify roles!"});
		}

		// Check if role to add/remove actually exists
		const data: ModifyRoleRequest = req.body as ModifyRoleRequest;
		const role: Role | undefined = Role[data.role as keyof typeof Role];
		if (!role) {
			res.status(Constants.BAD_REQUEST).send({error: "invalid role passed in!"});
			return;
		}

		// Try to update roles, if possible
		await updateRoles(data.id, role, op).catch((error: string) => {
			console.log(error);
			res.status(Constants.INTERNAL_ERROR).send({error: error});
		});

		// Get new roles for the current user, and return them
		await getRoles(data.id).then((roles: Role[]) => {
			res.status(Constants.SUCCESS).send({id: data.id, roles: roles});
		}).catch((error: string) => {
			console.log(error);
			res.status(Constants.INTERNAL_ERROR).send({error: error});
		});
	} catch (error) {
		res.status(Constants.FORBIDDEN).send(error);
	}
});


authRouter.get("/list/roles/", (req: Request, res: Response) => {
	try {
		const payload: JwtPayload = decodeJwtToken(req.headers.authorization);

		// Check if current user should be able to access all roles
		if (!hasElevatedPerms(payload)) {
			res.status(Constants.FORBIDDEN).send({error: "not authorized to perform this operation!"});
			return;
		}

		// Filter enum to get all possible string keys
		const roles: string[] = Object.keys(Role).filter((item: string) => {
			return isNaN(Number(item));
		});

		res.status(Constants.SUCCESS).send({roles: roles});
	} catch (error) {
		res.status(Constants.FORBIDDEN).send({error: error as string});
	}
});


authRouter.get("/roles/", (req: Request, res: Response) => {
	try {
		const payload: JwtPayload = decodeJwtToken(req.headers.authorization);
		res.status(Constants.SUCCESS).send({id: payload.id, roles: payload.roles});
	} catch (error) {
		res.status(Constants.FORBIDDEN).send({error: error as string});
	}
});


authRouter.get("/token/refresh", async (req: Request, res: Response) => {
	try {
		// Get old data from token
		const oldPayload: JwtPayload = decodeJwtToken(req.headers.authorization);
		const data: ProfileData = {
			id: oldPayload.id,
			email: oldPayload.email,
		};

		// Generate a new payload for the token
		let newPayload: JwtPayload | undefined;
		await getJwtPayload(oldPayload.provider, data).then((payload: JwtPayload) => {
			newPayload = payload;
		});

		// Create and return a new token with the payload
		const newToken: string = generateJwtToken(newPayload);
		res.status(Constants.SUCCESS).send({token: newToken});

	} catch (error) {
		res.status(Constants.FORBIDDEN).send({error: error as string});
	}
});


export default authRouter;
