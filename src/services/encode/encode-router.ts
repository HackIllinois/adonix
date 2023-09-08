import { Request, Response, Router } from "express";
import { EncodeFormat, DecodeFormat, DecodeToken } from "./encode-format";
import moment from "moment";
import CryptoJS from "crypto-js";

import Constants from "../../constants.js";
import * as console from "console";

const encodeRouter: Router = Router();

/**
 * @api {post} /encode POST /encode
 * @apiName Encode
 * @apiGroup Encode
 * @apiDescription Encode data in exchange for a token
 *
 * @apiBody {String} user Username
 * @apiBody {Object} data Arbitrary data
 * @apiParamExample {json} Example Request:
 * {
 *     "user": "john_doe",
 *     "data": {
 *         "role": "admin",
 *         "access_level": 5
 *     }
 * }
 *
 * @apiSuccess (200: Success) {String} token Encoded token representing your user and data
 * @apiSuccess (200: Success) {Object} context Empty dictionary for the sake of spec
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 * {
 *   "token": "U2FsdGVkX18/7neCNhOFAuA/+kkDx2IzqEI/89ce4YABPC6JMVUxVX1dO6yMq+xgZ6KWn3Cd/kgUAD/mmLwueuNlUm5Y1uQYcsBYxGudj3+tYZJ3PJBpLdQf4aPRBNIMTSU7OnEqrJrs8K1EZ12anA==",
 *   "context": {}
 * }
 */
encodeRouter.post("/encode", (req: Request, res: Response) => {
	const data: EncodeFormat = req.body as EncodeFormat;
	const key: string = process.env.key ?? "key";

	const exp: number = parseInt(process.env.exp ?? "0");
	const time: number = moment().add(exp, "s").valueOf();

	console.log(time);

	const ciphertext: string = CryptoJS.AES.encrypt(JSON.stringify({ data, time }), key).toString();

	res.status(Constants.SUCCESS).send({ token: ciphertext, context: {} });
});

/**
 * @api {post} /decode POST /decode
 * @apiName Decode
 * @apiGroup Encode
 * @apiDescription Decode data unless it's expired
 *
 * @apiBody {String} token Token
 * @apiBody {Object} context {} for the sake of spec
 * @apiParamExample {json} Example Request:
 * {
 *     "token": "U2FsdGVkX18/7neCNhOFAuA/+kkDx2IzqEI/89ce4YABPC6JMVUxVX1dO6yMq+xgZ6KWn3Cd/kgUAD/mmLwueuNlUm5Y1uQYcsBYxGudj3+tYZJ3PJBpLdQf4aPRBNIMTSU7OnEqrJrs8K1EZ12anA==",
 *     "context": {}
 * }
 *
 * @apiSuccess (200: Success) {String} user Username
 * @apiSuccess (200: Success) {Object} data Arbitrary data
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 * {
 *   "user": "john_doe",
 *   "data": {
 *     "role": "admin",
 *     "access_level": 5
 *   }
 * }
 * @apiError (403: Forbidden) {String} error Token is expired
 *
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 403 Forbidden
 *     {"error": "expired"}
 */
encodeRouter.post("/decode", (req: Request, res: Response) => {
	const data: DecodeToken = req.body as DecodeToken;
	const key: string = process.env.key ?? "key";

	const text: string = CryptoJS.AES.decrypt(data.token, key).toString(CryptoJS.enc.Utf8);
	console.log(text);
	const obj: DecodeFormat = JSON.parse(text) as DecodeFormat;

	if (moment().isAfter(obj.time)) {
		res.status(Constants.FORBIDDEN).send({ error: "expired" });
		return;
	}

	const raw: EncodeFormat = obj.data;

	res.status(Constants.SUCCESS).send(raw);
});

export default encodeRouter;
