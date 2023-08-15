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


authRouter.get("/github/", (req: Request, res: Response, next: NextFunction) => {
	const provider: string = "github";
	SelectAuthProvider(provider)(req, res, next);
});

authRouter.get("/google/", (req: Request, res: Response, next: NextFunction) => {
	const provider: string = "google";
	SelectAuthProvider(provider)(req, res, next);
});


authRouter.get("/:PROVIDER/callback/", (req: Request, res: Response, next: NextFunction) => {
	const provider: string = req.params.PROVIDER ?? "";
	SelectAuthProvider(provider)(req, res, next);
}, async (req: Request, res: Response) => {
	// Throw unauthorized if request isn't authenticated
	if (!req.isAuthenticated()) {
		res.status(Constants.UNAUTHORIZED_REQUEST).send();
	}

	const user: GithubProfile | GoogleProfile = req.user as GithubProfile | GoogleProfile;
	const data: ProfileData = user._json as ProfileData;
	data.id = data.id ?? user.id;
	let payload: JwtPayload | undefined = undefined;
	
	await getJwtPayload(user.provider, data).then( (parsedPayload: JwtPayload) => {
		payload = parsedPayload;
	}).catch( (error: Error) => {
		res.status(Constants.BAD_REQUEST).send(error);
	});

	const token: string = generateJwtToken(payload);
	res.status(Constants.SUCCESS).send({ token: token });

});


authRouter.get("/roles/:USERID", async (req: Request, res: Response) => {
	const targetUser: string | undefined = req.params.USERID;

	if (!targetUser) {
		res.redirect("/auth/roles/");
		return;
	}

	try {
		const payload: JwtPayload = decodeJwtToken(req.headers.authorization);

		if (payload.id == targetUser) {
			res.status(Constants.SUCCESS).send({id: payload.id, roles: payload.roles});
		} else if (hasElevatedPerms(payload)) {
			var roles: Role[] = [];
			await getRoles(targetUser).then((targetRoles: Role[]) => {roles = targetRoles}).catch((error: Error) => {throw error});
			console.log(roles);
			res.status(Constants.SUCCESS).send({id: targetUser, roles: roles});
		}
		else {
			res.status(Constants.FORBIDDEN).send("not authorized to perform this operation!");
		}
	} catch (error) {
		res.status(Constants.FORBIDDEN).send(error);
	}
});


authRouter.put("/roles/:OPERATION/", async (req: Request, res: Response) => {
	const operation: string = req.params.OPERATION ?? "";

	const op: RoleOperation | undefined = (<any>RoleOperation)[operation];

	if (!op) {
		res.status(Constants.BAD_REQUEST).send({error: "operation not specified!"});
		return;
	}

	try {
		const payload: JwtPayload = decodeJwtToken(req.headers.authorization);

		if (!hasElevatedPerms(payload)) {
			res.status(Constants.FORBIDDEN).send({error: "not permitted to modify roles!"});
		}

		const data: ModifyRoleRequest = req.body as ModifyRoleRequest;
		const role: Role | undefined = (<any>Role)[data.role];
		if (!role) {
			res.status(Constants.BAD_REQUEST).send({error: "invalid role passed in!"});
			return;
		}

		await updateRoles(data.id, role, op).catch((error) => {
			console.log(error);
			res.status(Constants.INTERNAL_ERROR).send({error: error});
		});

		await getRoles(data.id).then((roles: Role[]) => {
			res.status(Constants.SUCCESS).send({id: data.id, roles: roles});
		}).catch((error) => {
			console.log(error);
			res.status(Constants.INTERNAL_ERROR).send({error: error});
		});

	} catch (error) {
		res.status(Constants.FORBIDDEN).send(error);
	}
})


authRouter.get("/list/roles/", (req: Request, res: Response) => {
	try {
		const payload: JwtPayload = decodeJwtToken(req.headers.authorization);

		if (!hasElevatedPerms(payload)) {
			res.status(Constants.FORBIDDEN).send({error: "not authorized to perform this operation!"});
			return;
		}

		const roles: string[] = Object.keys(Role).filter((item) => {
			return isNaN(Number(item));
		});

		res.status(Constants.SUCCESS).send({roles: roles});
	} catch (error) {
		res.status(Constants.FORBIDDEN).send({error: error});
	}
}) 


authRouter.get("/roles/", (req: Request, res: Response) => {
	try {
		const payload: JwtPayload = decodeJwtToken(req.headers.authorization);
		console.log(payload);
		res.status(Constants.SUCCESS).send({id: payload.id, roles: payload.roles});
	} catch (error) {
		res.status(Constants.FORBIDDEN).send({error: error});
	}
});


authRouter.get("/token/refresh", async (req: Request, res: Response) => {
	try {
		const oldPayload: JwtPayload = decodeJwtToken(req.headers.authorization);
		const data: ProfileData = {
			id: oldPayload.id,
			email: oldPayload.email
		}
		var newPayload: JwtPayload | undefined;
		await getJwtPayload(oldPayload.provider, data).then((payload: JwtPayload) => {newPayload = payload});

		const newToken: string = generateJwtToken(newPayload);
		res.status(Constants.SUCCESS).send({token: newToken});

	} catch (error) {
		res.status(Constants.FORBIDDEN).send({error: error})
	}
});


export default authRouter;
