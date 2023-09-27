import { Request, Response, Router } from "express";
import { regexPasses } from "../../utils.js";
import cors, { CorsOptions } from "cors";

import Constants from "../../constants.js";

import { Collection } from "mongodb";
import databaseClient from "../../database.js";
import { SubscribeRequest } from "./newsletter-formats.js";
import { NewsletterDB } from "./newsletter-schemas.js";


const newsletterRouter: Router = Router();


// Only allow a certain set of regexes to be allowed via CORS
const allowedOrigins: RegExp[] = [
	new RegExp(process.env.PROD_REGEX ?? ""),
	new RegExp(process.env.DEPLOY_REGEX ?? ""),
];


// CORS options configuration
const corsOptions: CorsOptions = {
	origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
		if (!origin || regexPasses(origin, allowedOrigins)) {
			callback(null, true);
		} else {
			callback(new Error("Not allowed by CORS"));
		}
	},
};


// Use CORS for exclusively the newsletter - public access
newsletterRouter.use(cors(corsOptions));


/**
 * @api {post} /newsletter/subscribe/ POST /newsletter/subscribe/
 * @apiGroup Newsletter
 * @apiDescription Subscribe an email address to a newsletter. Will create a newsleter if it doesn't exist.
 *
 * @apiBody {String} listName Name of the list to add the user to
 * @apiBody {String} emailAddress Email address to add to the list
 * @apiParamExample {json} Example Request:
 * {"listName": "testingList", "emailAddress": "example@hackillinois.org" }
 *
 * @apiSuccess {String} status Status of the request
 * @apiSuccessExample Example Success Response:
 *     HTTP/1.1 200 OK
 *     {"status": "Succesful"}
 *
 * @apiError (400: Bad Request) {String} InvalidParams Invalid input passed in (missing name or email)
 * @apiError (400: Bad Request) {String} ListNotFound List doesn't exist within the database
 *
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 400 Bad Request
 *     {"error": "InvalidParams"}
 */
newsletterRouter.post("/subscribe/", async (request: Request, res: Response) => {
	const requestBody: SubscribeRequest = request.body as SubscribeRequest;
	const listName: string | undefined = requestBody.listName;
	const emailAddress: string | undefined = requestBody.emailAddress;

	// Verify that both parameters do exist
	if (!listName || !emailAddress) {
		return res.status(Constants.BAD_REQUEST).send({ error: "InvalidParams" });
	}

	// Upsert to update the list - update document if possible, else add the document
	const newsletterCollection: Collection = databaseClient.db(Constants.NEWSLETTER_DB).collection(NewsletterDB.NEWSLETTERS);
	try {
		await newsletterCollection.updateOne({ listName: listName }, { "$addToSet": { "subscribers": emailAddress } }, { upsert: true });
		return res.status(Constants.SUCCESS).send( {status: "Success" });
	} catch (error) {
		res.status(Constants.BAD_REQUEST).send({ error: "ListNotFound" });
	}
	
	return res.status(Constants.SUCCESS).send({ status: "Successful" });
});


export default newsletterRouter;
