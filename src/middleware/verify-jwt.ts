import { RequestHandler } from "express";
import { decodeJwtToken } from "../services/auth/auth-lib.js";
import jsonwebtoken from "jsonwebtoken";
import { StatusCode } from "status-code-enum";
import { JwtPayload, jwtValidator } from "../services/auth/auth-models.js";
import { z } from "zod";
import { Locals } from "express-serve-static-core";

/**
 * Middleware function factory that checks if the incoming request strictly has a JWT token.
 *
 * TODO: Discuss whether if valid roles should be passed into the factory function (e.g list of Role
 * enums).
 *
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
export function strongJwtVerification(): RequestHandler<
    /* eslint-disable  @typescript-eslint/no-explicit-any */ any,
    /* eslint-disable  @typescript-eslint/no-explicit-any */ any,
    /* eslint-disable  @typescript-eslint/no-explicit-any */ any,
    /* eslint-disable  @typescript-eslint/no-explicit-any */ any,
    Record<string, any> & Locals & { payload: JwtPayload }
> {
    return (req, res, next) => {
        const token: string | undefined = req.headers.authorization;

        if (!token) {
            res.status(StatusCode.ClientErrorUnauthorized).send({ error: "NoToken" });
            next("router");
            return;
        }

        try {
            const parsed = z.object({ payload: jwtValidator }).parse({ payload: decodeJwtToken(token) });
            res.locals = parsed;
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
    };
}

/**
 * Middleware factory function that simply parses the authroization JWT if provided by the request.
 * Will not terminate further request handling if no token is provided.
 *
 * @apiDefine weakVerifyErrors
 * @apiHeader  {String} Authorization JWT token.
 * @apiHeaderExample {json} Example Headers:
 *     {"Authorization": "loremipsumdolorsitamet"}
 */
export function weakJwtVerification(): RequestHandler<
    /* eslint-disable  @typescript-eslint/no-explicit-any */ any,
    /* eslint-disable  @typescript-eslint/no-explicit-any */ any,
    /* eslint-disable  @typescript-eslint/no-explicit-any */ any,
    /* eslint-disable  @typescript-eslint/no-explicit-any */ any,
    Record<string, any> & Locals & { payload: JwtPayload | undefined }
> {
    return (req, res, next) => {
        const token: string | undefined = req.headers.authorization;

        try {
            const parsed = z.object({ payload: jwtValidator }).parse({ payload: decodeJwtToken(token) });
            res.locals = parsed;
            next();
        } catch (error) {
            console.error(error);
            next();
        }
    };
}
