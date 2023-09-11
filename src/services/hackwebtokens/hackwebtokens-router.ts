import { Request, Router } from "express";
import { Response } from "express-serve-static-core";
import { decodeHackWebToken, encodeHackWebToken } from "./hackwebtokens-lib";
import { encodedPayload, encodingDecodingPayload } from "./hackwebtokens-models";
import Constants from "src/constants";

const eventsRouter: Router = Router();

/**
 * @api {post} /hackwebtokens/encode POST /hackwebtokens/encode
 * @apiGroup hackwebtokens
 * @apiDescription return a HackWebToken, which is an encoded version of the given data.
 *
 * @apiParam {interface} encodingDecodingPayload contains data to encode.
 * @apiParamExample {json} Example Request:
 * {"user": "bob", "data": {"hello_world":true, "test": "yes"} }
 *
 * @apiSuccess (200: Success) {String} token: the hackWebToken
 * @apiSuccess (200: Success) {String} context.additional_info: an encryption key to pass when trying to decode.
 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
 *		"token": "abcdefghij",
 * 		"context": {
 *          "additional_info": "sduweufweufww"
 *      }
 * 	}
 *
 * @apiError (400: Bad Request) {String} unknown_error: TODO - finish error handling
 */

eventsRouter.post("/encode", (req: Request, res: Response) => {
    
    const data: encodingDecodingPayload = req.body as encodingDecodingPayload;
    encodeHackWebToken(data).then((response: encodedPayload) => {
        return res.status(Constants.SUCCESS).send(response);
    }).catch((error: Error) => {
        console.error(error);
        res.status(Constants.BAD_REQUEST).send({ error: "unknown_error" });
    });

});

/**
 * @api {post} /hackwebtokens/decode POST /hackwebtokens/decode
 * @apiGroup hackwebtokens
 * @apiDescription decodes a hackwebtoken back to its readable state.
 *
 * @apiParam {interface} encodedPayload contains data to decode.
 * @apiParamExample {json} Example Request:
 *      {"token": "abcdefghij", "context": {"additional_info": "sduweufweufww"}}
 *
 * @apiSuccess (200: Success) {String} user: the user from the original encoded data.
 * @apiSuccess (200: Success) {interface} data: any data from the original encoded data.
 * 	HTTP/1.1 200 OK
 *	{
 *		"user": "bob",
 * 		"data": {
 *          "hello_world": true,
 *          "test": "yes"
 *      }
 * 	}
 *
 * @apiError (400: Bad Request) {String} unknown_error: TODO - finish error handling
 */

eventsRouter.post("/decode", (req: Request, res: Response) => {
    const data: encodedPayload = req.body as encodedPayload;
    decodeHackWebToken(data).then((response: encodingDecodingPayload) => {
        return res.status(Constants.SUCCESS).send(response);
    }).catch((error: Error) => {
        console.error(error);
        res.status(Constants.BAD_REQUEST).send({ error: "unknown_error" });
    });

});

