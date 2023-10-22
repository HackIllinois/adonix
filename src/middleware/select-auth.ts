import { AuthenticateOptions } from "passport";
import { RequestHandler } from "express-serve-static-core";

import { authenticateFunction } from "../services/auth/auth-lib.js";
import Config from "../config.js";

const googleOptions: AuthenticateOptions = {
    session: false,
    scope: ["profile", "email"],
};
const githubOptions: AuthenticateOptions = { session: false };

type CustomOptions = AuthenticateOptions & {
    callbackURL: string;
};

/**
 * Given a provider, return the middleware function corresponding to the handler
 * @public
 * @param provider String representing the provider passed into the request
 * @param device String representing the device that auth is being performed on
 * @returns RequestHandler middleware, that's pre-configured for the provider
 */
export function SelectAuthProvider(provider: string, device: string): RequestHandler {
    if (provider == "google") {
        const options: CustomOptions = {
            ...googleOptions,
            callbackURL: Config.CALLBACK_URLS.GOOGLE,
        };
        options.callbackURL += `device=${device}`;
        return authenticateFunction("google", options);
    }

    if (provider == "github") {
        const options: CustomOptions = {
            ...githubOptions,
            callbackURL: Config.CALLBACK_URLS.GITHUB,
        };
        options.callbackURL += `device=${device}`;

        return authenticateFunction("github", options);
    }

    throw new Error("Provider not found!");
}
