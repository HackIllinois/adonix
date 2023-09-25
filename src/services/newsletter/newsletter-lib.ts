import { Request, Response } from "express";
import Constants from "../../constants.js";

import { Collection } from "mongodb";
import databaseClient from "../../database.js";
import { SubscribeRequest } from "./newsletter-formats.js";
import { NewsletterDB } from "./newsletter-schemas.js";


/**
 * Subscribe a user to a newsletter, given a body
 * @param request HTTP request received from the user
 * @param response Response to send to the user
 * @returns Promise, void if successful. Else, promise is rejected with reason for error
 */
export async function subscribeToNewsletter(request: Request, response: Response): Promise<void> {
	const requestBody: SubscribeRequest = request.body as SubscribeRequest;
	const listName: string | undefined = requestBody.listName;
	const emailAddress: string | undefined = requestBody.emailAddress;

	// Verify that both parameters do exist
	if (!listName || !emailAddress) {
		response.status(Constants.BAD_REQUEST).send({ error: "InvalidParams" });
	}

	// Upsert to update the list - update document if possible, else add the document
	try {
		const newsletterCollection: Collection = databaseClient.db(Constants.NEWSLETTER_DB).collection(NewsletterDB.NEWSLETTERS);
		await newsletterCollection.updateOne({ listName: listName }, { "$addToSet": { "subscribers": emailAddress } }, { upsert: true });
	} catch (error) {
		response.status(Constants.BAD_REQUEST).send({ error: "ListNotFound" });
	}
	
	response.status(Constants.SUCCESS).send({ status: "Successful" });
	return Promise.resolve();
}
