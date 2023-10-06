import "dotenv";
import morgan from "morgan";
import express, { Application, Request, Response } from "express";

import Constants from "./constants.js";
import authRouter from "./services/auth/auth-router.js";
import userRouter from "./services/user/user-router.js";
import eventRouter from "./services/event/event-router.js";
import profileRouter from "./services/profile/profile-router.js";
import newsletterRouter from "./services/newsletter/newsletter-router.js";
import helmet from "helmet";

const app: Application = express();

// Utility packages (detailed in the readme)
app.use(helmet({ crossOriginResourcePolicy: false }));
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

// Ensure that API is running
app.get("/", (_: Request, res: Response) => {
    res.end("API is working!!!");
});

// Throw an error if call is made to the wrong API endpoint
app.use("/", (_: Request, res: Response) => {
    res.status(Constants.NOT_FOUND).end("API endpoint does not exist!");
});

export function startServer(): Promise<Express.Application> {
    // eslint-disable-next-line no-magic-numbers
    const port = process.env.PORT || 3000;

    return new Promise((resolve) => {
        const server = app.listen(port, () => {
            console.log(`✅ Server served on http://localhost:${port}...`);
            resolve(server);
        });
    });
}

export default app;
