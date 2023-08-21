import { Request, Response, NextFunction} from "express";

import Constants from "../constants.js";
import { decodeJwtToken } from "../services/auth/auth-lib.js";
import jsonwebtoken from "jsonwebtoken";

export function verifyJwt(req: Request, res: Response, next: NextFunction): void {
	const token: string | undefined = req.headers.authorization;

	if (!token) {
		res.status(Constants.FORBIDDEN).send({error: "no token passed!"});
		next("route");
	}

	try {
		res.locals.payload = decodeJwtToken(token);
		next();
	} catch (error) {
		if (error instanceof jsonwebtoken.TokenExpiredError) {
			console.log("token expired!");
			res.status(Constants.FORBIDDEN).send("TOKEN EXPIRED");
			next("router");
		} else {
			console.log(error);
			res.status(Constants.FORBIDDEN).send({error: error as string});
			next("router");
		}
	}
}
