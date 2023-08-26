import { Router, Request, Response } from "express";

import Constants from "../../constants.js";
import { verifyJwt } from "../../middleware/verify-jwt.js";

import { JwtPayload } from "../auth/auth-models.js";
import { generateJwtToken, getJwtPayloadFromDB, hasElevatedPerms } from "../auth/auth-lib.js";

import { UserSchema } from "./user-schemas.js";
import { UserFormat } from "./user-formats.js";
import { getUser, updateUser } from "./user-lib.js";

const userRouter: Router = Router();

/**
 * @api {get} /user/qr/ GET /user/qr/
 * @apiGroup User
 * @apiDescription Get a QR code with a pre-defined expiration for the user provided in the JWT token. Since expiry is set to 20 seconds, 
 * we recommend that the results from this endpoint are not stored, but instead used immediately.
 *
 * @apiSuccess (200: Success) {String} id User to generate a QR code for 
 * @apiSuccess (200: Success) {String} qrInfo Stringified QR code for the given user

 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
 *		"id": "provider000001",
 * 		"qrinfo": "hackillinois://user?userToken=loremipsumdolorsitamet"
 * 	}
 *
 * @apiUse verifyErrors
 */
userRouter.get("/qr/", verifyJwt, (_: Request, res: Response) => {
	// Return the same payload, but with a shorter expiration time
	const payload: JwtPayload = res.locals.payload as JwtPayload;
	const token: string = generateJwtToken(payload, "20s");
	const uri: string = `hackillinois://user?userToken=${token}`;
	res.status(Constants.SUCCESS).send({ id: payload.id, qrInfo: uri });
});


/**
 * @api {get} /user/qr/:USERID/ GET /user/qr/:USERID/
 * @apiGroup User
 * @apiDescription Get a QR code with a pre-defined expiration for a particular user, provided that the JWT token's user has elevated perms. Since expiry is set to 20 seconds, 
 * we recommend that the results from this endpoint are not stored, but instead used immediately.
 *
 * @apiParam {String} USERID to generate the QR code for.
 * 
 * @apiSuccess (200: Success) {String} id User to generate a QR code for 
 * @apiSuccess (200: Success) {String} qrInfo Stringified QR code for the user to be used

 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
 *		"id": "provider000001",
 * 		"qrinfo": "hackillinois://user?userToken=loremipsumdolorsitamet"
 * 	}
 *
 * @apiError (400: Bad Request) {String} UserNotFound User doesn't exist in the database.
 * @apiError (403: Forbidden) {String} Forbidden API access by user (no valid perms).
 * @apiUse verifyErrors
 */
userRouter.get("/qr/:USERID", verifyJwt, async (req: Request, res: Response) => {
	const targetUser: string | undefined = req.params.USERID as string;

	// If target user -> redirect to base function
	if (!targetUser) {
		res.redirect("/user/qr/");
		return;
	}

	const payload: JwtPayload = res.locals.payload as JwtPayload;

	// Check if target user -> if so, return same payload but modified expiry
	// Check if elevated -> if so, generate a new payload and return that one
	if (payload.id == targetUser) {
		const token: string = generateJwtToken(payload, "20s");
		const uri: string = `hackillinois://user?userToken=${token}`;
		res.status(Constants.SUCCESS).send({ id: payload.id, qrInfo: uri });
	} else if (hasElevatedPerms(payload)) {
		// Get a new payload, and return the updated token
		await getJwtPayloadFromDB(targetUser).then((newPayload: JwtPayload) => {
			const token: string = generateJwtToken(newPayload, "20s");
			const uri: string = `hackillinois://user?userToken=${token}`;
			res.status(Constants.SUCCESS).send({ id: targetUser, qrInfo: uri });
		}).catch( (error: string) => {
			console.error(error);
			res.status(Constants.BAD_REQUEST).send("UserNotFound");
		});
	} else {
		res.status(Constants.FORBIDDEN).send("Forbidden");
	}
});


/**
 * @api {get} /user/:USERID/ GET /user/:USERID/
 * @apiGroup User
 * @apiDescription Get user data for a particular user, provided that the JWT token's user has elevated perms.
 * @apiParam {String} USERID to generate the QR code for.
 *
 * @apiSuccess (200: Success) {String} id UserID
 * @apiSuccess (200: Success) {String} firstname User's first name.
 * @apiSuccess (200: Success) {String} lastname User's last name.
 * @apiSuccess (200: Success) {String} email Email address (staff gmail or Github email).

 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
		"id": "provider00001",
		"firstname": "john",
		"lastname": "doe",
		"email": "johndoe@provider.com"
 * 	}
 *
 * @apiError (400: Bad Request) {String} UserNotFound User doesn't exist in the database.
 * @apiError (403: Forbidden) {String} Forbidden API access by user (no valid perms).
 * @apiUse verifyErrors
 */
userRouter.get("/:USERID", verifyJwt, async (req: Request, res: Response) => {
	// If no target user, exact same as next route
	if (!req.params.USERID) {
		res.redirect("/");
	}

	const targetUser: string = req.params.USERID ?? "";

	// Get payload, and check if authorized
	const payload: JwtPayload = res.locals.payload as JwtPayload;
	if (payload.id == targetUser || hasElevatedPerms(payload)) {
		// Authorized -> return the user object
		await getUser(targetUser).then((user: UserSchema) => {
			res.status(Constants.SUCCESS).send(user);
		}).catch((error: string) => {
			res.status(Constants.INTERNAL_ERROR).send(error);
		});
	} else {
		res.status(Constants.FORBIDDEN).send({ error: "no valid auth provided!" });
	}
});


/**
 * @api {get} /user/ GET /user/
 * @apiGroup User
 * @apiDescription Get user data for the current user in the JWT token.
 *
 * @apiSuccess (200: Success) {String} id UserID
 * @apiSuccess (200: Success) {String} firstname User's first name.
 * @apiSuccess (200: Success) {String} lastname User's last name.
 * @apiSuccess (200: Success) {String} email Email address (staff gmail or Github email).

 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
		"id": "provider00001",
		"firstname": "john",
		"lastname": "doe",
		"email": "johndoe@provider.com"
 * 	}
 *
 * @apiUse verifyErrors
 */
userRouter.get("/", verifyJwt, async (_: Request, res: Response) => {
	// Get payload, return user's values
	const payload: JwtPayload = res.locals.payload as JwtPayload;
	try {
		const user: UserSchema = await getUser(payload.id);
		res.status(Constants.SUCCESS).send(user);
	} catch (error) {
		if (error == "UserNotFound") {
			res.status(Constants.BAD_REQUEST).send("UserNotFound");
		}

		res.status(Constants.INTERNAL_ERROR).send("InternalError");
	}
});


/**
 * @api {post} /user/ POST /user/
 * @apiGroup User
 * @apiDescription Update a given user
 *
 * @apiBody {String} id UserID
 * @apiBody {String} firstname User's first name.
 * @apiBody {String} lastname User's last name.
 * @apiBody {String} email Email address (staff gmail or Github email).
 * @apiParamExample {json} Example Request: 
 *	{
		"id": "provider00001",
		"firstname": "john",
		"lastname": "doe",
		"email": "johndoe@provider.com"
 * 	}
 * 
 * @apiSuccess (200: Success) {String} id UserID
 * @apiSuccess (200: Success) {String} firstname User's first name.
 * @apiSuccess (200: Success) {String} lastname User's last name.
 * @apiSuccess (200: Success) {String} email Email address (staff gmail or Github email).

 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
		"id": "provider00001",
		"firstname": "john",
		"lastname": "doe",
		"email": "johndoe@provider.com"
 * 	}
 *
 * @apiUse verifyErrors
 */
userRouter.post("/", verifyJwt, async (req: Request, res: Response) => {
	const token: JwtPayload = res.locals.payload as JwtPayload;

	if (!hasElevatedPerms(token)) {
		res.status(Constants.FORBIDDEN).send({ error: "token not authorized to perform this!" });
	}

	// Get userData from the request, and print to output
	const userData: UserFormat = req.body as UserFormat;

	if (!userData.id|| !userData.email || !userData.firstname || !userData.lastname || !userData.username) {
		res.status(Constants.BAD_REQUEST).send({ error: "InvalidParams" });
		return;
	}

	// Update the given user
	await updateUser(userData);

	// Return new value of the user
	await getUser(userData.id).then((user: UserSchema) => {
		res.status(Constants.SUCCESS).send(user);
	}).catch((error: string) => {
		console.error(error);
		res.status(Constants.INTERNAL_ERROR).send({error: "InternalError"});
	});
});


export default userRouter;
