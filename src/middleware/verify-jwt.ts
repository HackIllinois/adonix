import { Request, Response, NextFunction} from "express";
import Constants from "../constants.js";
import { decodeJwtToken } from "../services/auth/auth-lib.js";
import jsonwebtoken from "jsonwebtoken";

/**
 * @apiDefine verifyErrors
 * @apiHeader  {String} Authorization JWT token.
 * @apiHeaderExample {json} Example Headers:
 *     {"Authorization": "loremipsumdolorsitamet"}
 *

 * @apiError (400: Bad Request) {string} NoToken No auth token passed in
 * @apiError (401: Unauthorized) {string} InvalidToken Invalid token passed in
 * @apiError (403: Forbidden) {string} TokenExpired Token has expired
 * @apiError (500: Internal Server Error) {string} InternalError Error internally with the server
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 400 Bad Request
 *     {"error": "NoToken"}
 */

export function verifyJwt(req: Request, res: Response, next: NextFunction): void {
	const token: string | undefined = req.headers.authorization;

	if (!token) {
		res.status(Constants.BAD_REQUEST).send({error: "NoToken"});
		next("route");
	}

	try {
		res.locals.payload = decodeJwtToken(token);
		next();
	} catch (error) {
		if (error instanceof jsonwebtoken.TokenExpiredError) {
			console.log("token expired!");
			res.status(Constants.FORBIDDEN).send("TokenExpired");
			next("router");
		} else {
			console.log(error);
			res.status(Constants.UNAUTHORIZED_REQUEST).send({error: "InvalidToken"});
			next("router");
		}
	}
}
