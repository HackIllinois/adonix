import { Router, Request, Response } from "express";

import Constants from "../../constants.js";
import { verifyJwt } from "../../middleware/verify-jwt.js";

import { JwtPayload } from "../auth/auth-models.js";
import { generateJwtToken, getJwtPayloadFromDB, hasElevatedPerms } from "../auth/auth-lib.js";

import { UserSchema } from "./user-schemas.js";
import { UserFormat } from "./user-formats.js";
import { getUser, updateUser } from "./user-lib.js";

const userRouter: Router = Router();


userRouter.get("/qr/", verifyJwt, (_: Request, res: Response) => {
	// Return the same payload, but with
	const payload: JwtPayload = res.locals.payload as JwtPayload;
	const token: string = generateJwtToken(payload, "20s");
	const uri: string = `hackillinois://user?userToken=${token}`;
	res.status(Constants.SUCCESS).send({ id: payload.id, qrInfo: uri });
});


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
		res.status(Constants.SUCCESS).send({ token: token });
	} else if (hasElevatedPerms(payload)) {
		// Get a new payload, and return the updated token
		await getJwtPayloadFromDB(targetUser).then((newPayload: JwtPayload) => {
			const token: string = generateJwtToken(newPayload, "20s");
			const uri: string = `hackillinois://user?userToken=${token}`;
			res.status(Constants.SUCCESS).send({ id: targetUser, qrInfo: uri });
		}).catch( (error: string) => {
			res.status(Constants.INTERNAL_ERROR).send(error);
		});
	} else {
		res.status(Constants.FORBIDDEN).send("Not authorized to perform this request!");
	}
});


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


userRouter.get("/", verifyJwt, async (_: Request, res: Response) => {
	// Get payload, return user's values
	const payload: JwtPayload = res.locals.payload as JwtPayload;
	const user: UserSchema = await getUser(payload.id);
	res.status(Constants.SUCCESS).send(user);
});


userRouter.post("/", verifyJwt, async (req: Request, res: Response) => {
	const token: JwtPayload = res.locals.payload as JwtPayload;

	if (!hasElevatedPerms(token)) {
		res.status(Constants.FORBIDDEN).send({ error: "token not authorized to perform this!" });
	}

	// Get userData from the request, and print to output
	const userData: UserFormat = req.body as UserFormat;

	if (!userData.id|| !userData.email || !userData.firstname || !userData.lastname || !userData.username) {
		res.status(Constants.BAD_REQUEST).send({ error: "bad request!" });
		return;
	}

	await updateUser(userData);

	// Return new value of the user
	await getUser(userData.id).then((user: UserSchema) => {
		res.status(Constants.SUCCESS).send(user);
	}).catch((error: string) => {
		res.status(Constants.INTERNAL_ERROR).send(error);
	});
});


export default userRouter;
