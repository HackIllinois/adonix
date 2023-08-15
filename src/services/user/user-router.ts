import { Router, Request, Response } from "express";

import Constants from "../../constants.js";
import { JwtPayload } from "../auth/auth-models.js";
import { hasElevatedPerms } from "../auth/auth-lib.js";
import { UserSchema } from "./user-schemas.js";
import { getUser, updateUser } from "./user-lib.js";
import { verifyJwt } from "../../middleware/verify-jwt.js";
import { UserFormat } from "./user-formats.js";


const userRouter: Router = Router();
userRouter.use(verifyJwt);


userRouter.get("/:USERID", async (req: Request, res: Response) => {
	const targetUser: string | undefined = req.params.USERID;

	// If no target user, exact same as next route
	if (!targetUser) {
		res.redirect("/");
		return;
	}

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
		res.status(Constants.FORBIDDEN).send({error: "no valid auth provided!"});
	}
});


userRouter.get("/", async (_: Request, res: Response) => {
	// Get payload, return user's values
	const payload: JwtPayload = res.locals.payload as JwtPayload;
	const user: UserSchema = await getUser(payload.id);
	res.status(Constants.SUCCESS).send(user);
});


userRouter.post("/", async (req: Request, res: Response) => {
	const token: JwtPayload = res.locals.payload as JwtPayload;

	if (!hasElevatedPerms(token)) {
		res.status(Constants.FORBIDDEN).send({error: "token not authorized to perform this!"});
	}

	// Get userData from the request, and print to output
	const userData: UserFormat = req.body as UserFormat;

	if (!userData.id|| !userData.email || !userData.firstname || !userData.lastname || !userData.username) {
		res.status(Constants.BAD_REQUEST).send({error: "bad request!"});
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


// TODO: ADD IN FILTER + QR FUNCTIONS


export default userRouter;
