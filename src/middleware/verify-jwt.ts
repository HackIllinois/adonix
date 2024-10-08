import { Request, Response, NextFunction } from "express";
import { decodeJwtToken } from "../services/auth/auth-lib";
import jsonwebtoken from "jsonwebtoken";
import { StatusCode } from "status-code-enum";
import Config from "../config";

// TODO: Remove all usages of these

/**
 * @apiDefine strongVerifyErrors
 * @apiHeader  {String} Authorization JWT token.
 * @apiHeaderExample {json} Example Headers:
 *     {"Authorization": "loremipsumdolorsitamet"}
 *

 * @apiError (401: Unauthorized) {string} NoToken No token passed in request.
 * @apiError (401: Unauthorized) {string} InvalidToken Invalid token (not API-signed).
 * @apiError (403: Forbidden) {string} TokenExpired Expired token.
 * @apiError (500: Internal Error) {string} InternalError Server error.
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 400 Bad Request
 *     {"error": "NoToken"}
 */
export function strongJwtVerification(req: Request, res: Response, next: NextFunction): void {
    const token = req.headers.authorization;

    if (!token) {
        res.status(StatusCode.ClientErrorUnauthorized).send({ error: "NoToken" });
        next("router");
        return;
    }

    try {
        res.locals.payload = decodeJwtToken(token);
        if (!Config.TEST) {
            console.log(`new request from user: ${res.locals.payload.id}`);
        }
        next();
    } catch (error) {
        console.error(error);
        if (error instanceof jsonwebtoken.TokenExpiredError) {
            res.status(StatusCode.ClientErrorForbidden).send("TokenExpired");
            next("router");
        } else {
            res.status(StatusCode.ClientErrorUnauthorized).send({
                error: "InvalidToken",
            });
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
    const token = req.headers.authorization;

    try {
        res.locals.payload = decodeJwtToken(token);
        if (!Config.TEST) {
            console.log(`new request from user: ${res.locals.payload.id}`);
        }
        next();
    } catch (error) {
        console.error(error);
        next();
    }
}
