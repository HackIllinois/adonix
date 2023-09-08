import { Request, Response, Router } from "express";
import { EncodeFormat, DecodeFormat, DecodeToken } from "./encode-format";
import moment from "moment";
import CryptoJS from "crypto-js";

import Constants from "../../constants.js";
import * as console from "console";

const encodeRouter: Router = Router();

encodeRouter.post("/encode", (req: Request, res: Response) => {
	const data: EncodeFormat = req.body as EncodeFormat;
	const key: string = process.env.key ?? "key";

	const exp: number = parseInt(process.env.exp ?? "0");
	const time: number = moment().add(exp, "s").valueOf();

	console.log(time);

	const ciphertext: string = CryptoJS.AES.encrypt(JSON.stringify({ data, time }), key).toString();

	res.status(Constants.SUCCESS).send({ token: ciphertext });
});

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
