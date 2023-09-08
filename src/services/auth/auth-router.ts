import "dotenv";

import { NextFunction } from "express-serve-static-core";
import express, { Request, Response, Router } from "express";

import passport from "passport";
import GitHubStrategy, { Profile as GithubProfile } from "passport-github";
import { Strategy as GoogleStrategy, Profile as GoogleProfile } from "passport-google-oauth20";

import { Role } from "../../models.js";
import Constants from "../../constants.js";
import { verifyJwt } from "../../middleware/verify-jwt.js";
import { SelectAuthProvider } from "../../middleware/select-auth.js";

import { ModifyRoleRequest } from "./auth-formats.js";
import { JwtPayload, ProfileData, Provider, RoleOperation } from "./auth-models.js";
import { generateJwtToken, getDevice, getJwtPayloadFromProfile, getRoles, hasElevatedPerms, updateRoles, verifyFunction } from "./auth-lib.js";


passport.use(Provider.GITHUB, new GitHubStrategy({
	clientID: process.env.GITHUB_OAUTH_ID ?? "a",
	clientSecret: process.env.GITHUB_OAUTH_SECRET ?? "",
	callbackURL: Constants.GITHUB_OAUTH_CALLBACK,
}, verifyFunction));


passport.use(Provider.GOOGLE, new GoogleStrategy({
	clientID: process.env.GOOGLE_OAUTH_ID ?? "a",
	clientSecret: process.env.GOOGLE_OAUTH_SECRET ?? "",
	callbackURL: Constants.GOOGLE_OAUTH_CALLBACK,
}, verifyFunction));


const authRouter: Router = Router();
authRouter.use(express.urlencoded({ extended: false }));


authRouter.get("/test/", (_: Request, res: Response) => {
	res.end("Auth endpoint is working!");
});


/**
 * @api {get} /auth/login/github/ GET /auth/login/github/
 * @apiName Github
 * @apiGroup Auth
 * @apiDescription Perform Github authentication for an attendee.
 *
 * @apiQuery {String} device=web Type of the device to be passed in, can take on "web", "ios", and "android", but defaults to web.
 *
 * @apiSuccess (200: Success) {String} token JWT token of authenticated user
 * @apiSuccessExample Example Success Response:
 *     HTTP/1.1 200 OK
 *     {"token": "loremipsumdolorsitamet"}

 * @apiError (400: Bad Request) {String} InvalidData User profile doesn't have enough data for JWT
 * @apiError (400: Bad Request) {String} BadDevice An invalid device was passed in.
 * @apiError (401: Unauthorized) {String} FailedAuth Invalid input passed in (missing name or email)
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 400 Bad Request
 *     {"error": "InvalidParams"}
 */
authRouter.get("/login/github/", (req: Request, res: Response, next: NextFunction) => {
	const device: string = req.query.device as string | undefined ?? Constants.DEFAULT_DEVICE;

	if (device && !Constants.DEVICE_LIST.includes(device)) {
		res.status(Constants.BAD_REQUEST).send({ error: "BadDevice" });
		return;
	}
	SelectAuthProvider("github", device)(req, res, next);
});

/**
 * @api {get} /auth/login/google/ GET /auth/login/google/
 * @apiName Google
 * @apiGroup Auth
 * @apiDescription Perform Google authentication for a staff member.
 *
 * @apiQuery {String} device=web Type of the device to be passed in, can take on "web", "ios", and "android", but defaults to web.
 *
 * @apiSuccess (200: Success) {String} token JWT token of authenticated user
 * @apiSuccessExample Example Success Response:
 *     HTTP/1.1 200 OK
 *     {"token": "loremipsumdolorsitamet"}
 *
 * @apiError (400: Bad Request) {String} BadDevice An invalid device was passed in.
 * @apiError (400: Bad Request) {String} InvalidData User profile doesn't have enough data for JWT
 * @apiError (401: Unauthorized) {String} FailedAuth Invalid input passed in (missing name or email)
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 400 Bad Request
 *     {"error": "InvalidParams"}
 */
authRouter.get("/login/google/", (req: Request, res: Response, next: NextFunction) => {
	const device: string = req.query.device as string | undefined ?? Constants.DEFAULT_DEVICE;

	if (device && !Constants.DEVICE_LIST.includes(device)) {
		res.status(Constants.BAD_REQUEST).send({ error: "BadDevice" });
		return;
	}
	SelectAuthProvider("google", device)(req, res, next);
});


authRouter.get("/:PROVIDER/callback/:DEVICE", (req: Request, res: Response, next: NextFunction) => {
	const provider: string = req.params.PROVIDER ?? "";
	try {
		const device: string = getDevice(req.params.DEVICE);
		res.locals.device = device;
		SelectAuthProvider(provider, device)(req, res, next);
	} catch (error) {
		console.error(error);
	}
}, async (req: Request, res: Response) => {
	if (!req.isAuthenticated()) {
		res.status(Constants.UNAUTHORIZED_REQUEST).send({ error: "FailedAuth" });
	}

	const device: string = (res.locals.device ?? Constants.DEFAULT_DEVICE) as string;
	const user: GithubProfile | GoogleProfile = req.user as GithubProfile | GoogleProfile;
	const data: ProfileData = user._json as ProfileData;

	data.id = data.id ?? user.id;
	let payload: JwtPayload | undefined = undefined;

	// Load in the payload with the actual values stored in the database
	await getJwtPayloadFromProfile(user.provider, data).then((parsedPayload: JwtPayload) => {
		payload = parsedPayload;
	}).catch((error: Error) => {
		console.error(error);
		res.status(Constants.BAD_REQUEST).send({ error: "InvalidData" });
	});

	// Generate the token, and return it
	const token: string = generateJwtToken(payload);
	const redirect: string = (Constants.REDIRECT_MAPPINGS.get(device) ?? Constants.DEFAULT_REDIRECT);
	const url: string = `${redirect}?token=${token}`;
	console.log("Redirecting!", url);
	res.redirect(url);
});


/**
 * @api {get} /auth/roles/:USERID/ GET /auth/roles/:USERID/
 * @apiGroup Auth
 * @apiDescription Get the roles of a user, provided that there is a JWT token and the token contains VALID credentials for the operation.
 *
 * @apiParam {String} USERID Target user to get the roles of. Defaults to the user provided in the JWT token, if no user provided.
 *
 * @apiSuccess (200: Success) {String} id User ID.
 * @apiSuccess (200: Success) {String[]} roles Roles of the target user.
 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
 *		"id": "provider0000001",
 * 		"roles": ["Admin", "Staff", "Mentor"]
 * 	}
 *
 * @apiUse verifyErrors
 * @apiError (400: Bad Request) {String} UserNotFound User doesn't exist in the database.
 * @apiError (403: Forbidden) {String} Forbidden API accessed by user without valid perms.
 */
authRouter.get("/roles/:USERID", verifyJwt, async (req: Request, res: Response) => {
	const targetUser: string | undefined = req.params.USERID;

	// Check if we have a user to get roles for - if not, get roles for current user
	if (!targetUser) {
		res.redirect("/auth/roles/");
		return;
	}

	const payload: JwtPayload = res.locals.payload as JwtPayload;

	// Cases: Target user already logged in, auth user is admin
	if (payload.id == targetUser) {
		res.status(Constants.SUCCESS).send({ id: payload.id, roles: payload.roles });
	} else if (hasElevatedPerms(payload)) {
		let roles: Role[] = [];
		await getRoles(targetUser).then((targetRoles: Role[]) => {
			roles = targetRoles;
			res.status(Constants.SUCCESS).send({ id: targetUser, roles: roles });
		}).catch((error: Error) => {
			console.error(error);
			res.status(Constants.BAD_REQUEST).send({ error: "UserNotFound" });
		});
	} else {
		res.status(Constants.FORBIDDEN).send("Forbidden");
	}
});


/**
 * @api {put} /auth/roles/:OPERATION/ PUT /auth/roles/:OPERATION/
 * @apiGroup Auth
 * @apiDescription Given an operation (ADD/REMOVE), perform this operation on the given user.
 *
 * @apiParam {String} OPERATION Operation to perform on the target user. MUST BE EITHER "ADD" OR "REMOVE".
 *
 * @apiSuccess (200: Success) {String} id ID of the target user.
 * @apiSuccess (200: Success) {String[]} roles Roles of the selected user, post-completion of the requested operation.
 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
 *		"id": "provider0000001",
 * 		"roles": ["Admin", "Staff", "Mentor"]
 * 	}
 *
 * @apiError (400: Bad Request) {String} UserNotFound User doesn't exist, to perform these operations on.
 * @apiError (400: Bad Request) {String} InvalidOperation Invalid (non-ADD and non-REMOVE) operation passed in.
 * @apiError (400: Bad Request) {String} InvalidRole Nonexistent role passed in.
 * @apiUse verifyErrors
 */
authRouter.put("/roles/:OPERATION/", verifyJwt, async (req: Request, res: Response) => {
	const payload: JwtPayload = res.locals.payload as JwtPayload;

	// Not authenticated with modify roles perms
	if (!hasElevatedPerms(payload)) {
		res.status(Constants.FORBIDDEN).send({ error: "Forbidden" });
	}

	// Parse to get operation type
	const op: RoleOperation | undefined = RoleOperation[req.params.operation as keyof typeof RoleOperation];

	// No operation - fail out
	if (!op) {
		res.status(Constants.BAD_REQUEST).send({ error: "InvalidOperation" });
		return;
	}

	// Check if role to add/remove actually exists
	const data: ModifyRoleRequest = req.body as ModifyRoleRequest;
	const role: Role | undefined = Role[data.role as keyof typeof Role];
	if (!role) {
		res.status(Constants.BAD_REQUEST).send({ error: "InvalidRole" });
		return;
	}

	// Try to update roles, if possible
	await updateRoles(data.id, role, op).catch((error: string) => {
		console.error(error);
		res.status(Constants.INTERNAL_ERROR).send({ error: "InternalError" });
	});

	// Get new roles for the current user, and return them
	await getRoles(data.id).then((roles: Role[]) => {
		res.status(Constants.SUCCESS).send({ id: data.id, roles: roles });
	}).catch((error: string) => {
		console.error(error);
		res.status(Constants.BAD_REQUEST).send({ error: "UserNotFound" });
	});
});


/**
 * @api {get} /auth/list/roles/ GET /auth/list/roles/
 * @apiGroup Auth
 * @apiDescription List all the available roles.
 *
 * @apiSuccess (200: Success) {string[]} token JWT token of authenticated user.
 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
 *		"id": "provider0000001",
 * 		"roles": ["Admin", "Staff", "Mentor"]
 * 	}
 *
 * @apiUse verifyErrors
 * @apiError (400: Bad Request) {String} UserNotFound User doesn't exist in the database
 * @apiError (403: Forbidden) {String} Forbidden API accessed by user without valid perms
 */
authRouter.get("/list/roles/", verifyJwt, (_: Request, res: Response) => {
	const payload: JwtPayload = res.locals.payload as JwtPayload;

	// Check if current user should be able to access all roles
	if (!hasElevatedPerms(payload)) {
		res.status(Constants.FORBIDDEN).send({ error: "not authorized to perform this operation!" });
		return;
	}

	// Filter enum to get all possible string keys
	const roles: string[] = Object.keys(Role).filter((item: string) => {
		return isNaN(Number(item));
	});

	res.status(Constants.SUCCESS).send({ roles: roles });
});


/**
 * @api {get} /auth/roles/ GET /auth/roles/
 * @apiGroup Auth
 * @apiDescription Get the roles of a user from the database, provided that there is a JWT token and the token contains VALID credentials for the operation.
 *
 * @apiSuccess (200: Success) {String} id ID of the user in the request token payload.
 * @apiSuccess (200: Success) {String[]} roles Roles of the user, from the database.
 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
 *		"id": "provider0000001",
 * 		"roles": ["Admin", "Staff", "Mentor"]
 * 	}
 *
 * @apiUse verifyErrors
 */
authRouter.get("/roles/", verifyJwt, async (_: Request, res: Response) => {
	const payload: JwtPayload = res.locals.payload as JwtPayload;
	const targetUser: string = payload.id;

	await getRoles(targetUser).then((roles: Role[]) => {
		res.status(Constants.SUCCESS).send({ id: targetUser, roles: roles });
	}).catch((error: Error) => {
		console.error(error);
		res.status(Constants.BAD_REQUEST).send({ error: "UserNotFound" });
	});
});

/**
 * @api {get} /auth/token/refresh/ GET /auth/token/refresh/
 * @apiGroup Auth
 * @apiDescription Refresh a JWT token - payload data stays consistent, but expiration date changes.
 *
 * @apiSuccess (200: Success) {String} token New JWT token with extended expiry time.
 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
 * 		"token": "loremipsumdolorsitamet"
 * 	}
 *
 * @apiUse verifyErrors
 */
authRouter.get("/token/refresh", verifyJwt, async (_: Request, res: Response) => {
	// Get old data from token
	const oldPayload: JwtPayload = res.locals.payload as JwtPayload;
	const data: ProfileData = {
		id: oldPayload.id,
		email: oldPayload.email,
	};

	// Generate a new payload for the token
	let newPayload: JwtPayload | undefined;
	await getJwtPayloadFromProfile(oldPayload.provider, data).then((payload: JwtPayload) => {
		newPayload = payload;
	});

	// Create and return a new token with the payload
	const newToken: string = generateJwtToken(newPayload);
	res.status(Constants.SUCCESS).send({ token: newToken });
});


export default authRouter;
