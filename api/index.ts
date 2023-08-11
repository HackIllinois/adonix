import "dotenv";
import express, { Application, Request, Response } from "express";

import helmet from "helmet";
import morgan from "morgan";

import Constants from "./constants.js";
import authRouter from "./services/auth/auth-router.js";
import newsletterRouter from "./services/newsletter/newsletter-router.js";

const app: Application = express();

// Utility packages (detailed in the readme)
app.use(helmet());
app.use(morgan("dev"));

// Use express.json only if we're not running locally
const env: string = process.env?.VERCEL_ENV ?? "";
if (env == "preview" || env == "production") {
	app.use(express.json());
}

// Add routers for each sub-service
app.use("/auth/", authRouter);
app.use("/newsletter/", newsletterRouter);

// Ensure that API is running
app.get("/", (_: Request, res: Response) => {
	res.end("API is working!");
});

// Throw an error if call is made to the wrong API endpoint
app.use("/", (_: Request, res: Response) => {
	res.status(Constants.NOT_FOUND).end("API endpoint does not exist!");
});

export default app;
