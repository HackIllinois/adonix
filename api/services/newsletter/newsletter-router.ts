import { Router, Request, Response } from "express";
import { subscribeToNewsletter } from "./newsletter-lib.js";
import { regexPasses, wrappedHandler } from "../../utils.js";
import cors, { CorsOptions } from "cors";


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


// TODO: Add in documentation here
newsletterRouter.post("/subscribe/", (req: Request, res: Response) => {
	wrappedHandler(req, res, subscribeToNewsletter);
});


export default newsletterRouter;
