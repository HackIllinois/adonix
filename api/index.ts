import "dotenv";
import morgan from "morgan";
import express, { Application, Request, Response } from "express";

import Constants from "../src/constants.js";
import authRouter from "../src/services/auth/auth-router.js";
import userRouter from "../src/services/user/user-router.js";
import eventRouter from "../src/services/event/event-router.js";
import profileRouter from "../src/services/profile/profile-router.js";
import newsletterRouter from "../src/services/newsletter/newsletter-router.js";
import staffRouter from "../src/services/staff/staff-router.js";
import registrationRouter from "../src/services/registration/registration-router.js";

const app: Application = express();

// Utility packages (detailed in the readme)
// app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(morgan("dev"));

// Use express.json only if we're not running locally
const env: string = process.env?.VERCEL_ENV ?? "";
if (env == "preview" || env == "production") {
	app.use(express.json());
}

// Add routers for each sub-service
app.use("/auth/", authRouter);
app.use("/user/", userRouter);
app.use("/newsletter/", newsletterRouter);
app.use("/event/", eventRouter);
app.use("/profile/", profileRouter);
app.use("/staff/", staffRouter);
app.use("/registration/",registrationRouter);
// Ensure that API is running
app.get("/", (_: Request, res: Response) => {
	res.end("API is working!");
});

// Throw an error if call is made to the wrong API endpoint
app.use("/", (_: Request, res: Response) => {
	res.status(Constants.NOT_FOUND).end("API endpoint does not exist!");
});

export default app;
