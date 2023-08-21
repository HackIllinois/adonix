import { Request, Response } from "express";
import Constants from "../../constants.js";

import { Collection } from "mongodb";
import DatabaseHelper from "../../database.js";
import { SubscribeRequest } from "./newsletter-formats.js";


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

	console.log(listName);
	console.log(emailAddress);

	// Verify that both parameters do exist
	if (!listName || !emailAddress) {
		return Promise.reject("invalid input passed in!");
	}

	console.log("valid input, working with database");

	// Upsert to update the list - update document if possible, else add the document
	try {
		const newsletterCollection: Collection = await DatabaseHelper.getCollection("newsletters", "newsletters");
		await newsletterCollection.updateOne({listName: listName}, {"$addToSet": {"subscribers": emailAddress}}, {upsert: true});
	} catch (error) {
		console.log(error);
		return Promise.reject("invalid input passed in!");
	}
	
	response.status(Constants.SUCCESS).end("list should have been created!");
	return Promise.resolve();
}
