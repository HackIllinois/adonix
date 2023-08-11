import { Request, Response } from "express";
import Constants from "./constants.js";

// Type for arbitrary async REST handler type
export type apiFunction = (request: Request, response: Response) => Promise<void>;

// Function to convert an async function into synchronous
export function wrappedHandler(request: Request, response:Response, handler: apiFunction):void {
	handler(request, response).catch((error: Error) => {
		console.log("function failed!");
		response.status(Constants.FAILURE).json( {message: error});
	});
}

// Check if a single regex passes
export function regexPasses(target: string, patterns: RegExp[]): boolean {
	return patterns.some((pattern: RegExp) => {
		return pattern.test(target);
	});
}
