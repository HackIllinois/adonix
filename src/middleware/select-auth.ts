import { AuthenticateOptions } from "passport";
import { RequestHandler } from "express-serve-static-core";

import { authenticateFunction } from "../services/auth/auth-lib.js";
import Constants from "../constants.js";


const googleOptions: AuthenticateOptions = { session: false, scope: [ "profile", "email" ]};
const githubOptions: AuthenticateOptions = { session: false};

/**
 * Given a provider, return the middleware function corresponding to the handler
 * @public
 * @param provider String representing the provider passed into the request
 * @param device String representing the device that auth is being performed on
 * @returns RequestHandler middleware, that's pre-configured for the provider
 */
export function SelectAuthProvider(provider: string, device: string): RequestHandler {
	if (provider == "google") {
		const options = { ...googleOptions, callbackURL: Constants.GOOGLE_OAUTH_CALLBACK }; // Create a copy of options to modify
		return authenticateFunction("google", options);
	}

	if (provider == "github") {
		const options = { ...githubOptions, callbackURL: Constants.GITHUB_OAUTH_CALLBACK }; // Create a copy of options to modify
		options.callbackURL += `device=${device}`

		return authenticateFunction("github", options) as RequestHandler;
	}
	
	throw new Error("Provider not found!");
}
