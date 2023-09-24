import { Request, Response, NextFunction } from "express";
import Constants from "../constants.js";
import { decodeJwtToken } from "../services/auth/auth-lib.js";
import jsonwebtoken from "jsonwebtoken";

/**
 * @apiDefine strongVerifyErrors
 * @apiHeader  {String} Authorization JWT token.
 * @apiHeaderExample {json} Example Headers:
 *     {"Authorization": "loremipsumdolorsitamet"}
 *

 * @apiError (401: Unauthorized) {string} NoToken No token passed in request.
 * @apiError (401: Unauthorized) {string} InvalidToken Invalid token (not API-signed).
 * @apiError (403: Forbidden) {string} TokenExpired Expired token.
 * @apiError (500: Internal Server Error) {string} InternalError Server error.
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 400 Bad Request
 *     {"error": "NoToken"}
 */
export function strongJwtVerification(req: Request, res: Response, next: NextFunction): void {
	const token: string | undefined = req.headers.authorization;

	if (!token) {
		res.status(Constants.UNAUTHORIZED_REQUEST).send({ error: "NoToken" });
		next("router");
		return;
	}

	try {
		res.locals.payload = decodeJwtToken(token);
		next();
	} catch (error) {
		console.error(error);
		if (error instanceof jsonwebtoken.TokenExpiredError) {
			res.status(Constants.FORBIDDEN).send("TokenExpired");
			next("router");
		} else {
			res.status(Constants.UNAUTHORIZED_REQUEST).send({ error: "InvalidToken" });
			next("router");
		}
	}
}


/**
 * @apiDefine weakVerifyErrors
 * @apiHeader  {String} Authorization JWT token.
 * @apiHeaderExample {json} Example Headers:
 *     {"Authorization": "loremipsumdolorsitamet"}
 */
export function weakJwtVerification(req: Request, res: Response, next: NextFunction): void {
	const token: string | undefined = req.headers.authorization;

	try {
		res.locals.payload = decodeJwtToken(token);
		next();
	} catch (error) {
		console.error(error);
		next();
	}
}
 
