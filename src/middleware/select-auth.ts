import { RequestHandler } from "express-serve-static-core";
import { AuthenticateOptions } from "passport";

import { authenticateFunction } from "../services/auth/auth-lib.js";


const googleOptions: AuthenticateOptions = {session: false, scope: [ "profile", "email" ]};
const githubOptions: AuthenticateOptions = {session: false};


export function SelectAuthProvider(provider: string): RequestHandler {
	switch (provider) {
	case "google": return authenticateFunction("google", googleOptions);
	case "github": return authenticateFunction("github", githubOptions);
	}
	
	throw new Error("Provider not found!");
}
