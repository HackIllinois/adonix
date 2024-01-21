import morgan from "morgan";
import express, { Application, Request, Response } from "express";

import admissionRouter from "./services/admission/admission-router.js";
import authRouter from "./services/auth/auth-router.js";
import eventRouter from "./services/event/event-router.js";
import mailRouter from "./services/mail/mail-router.js";
import newsletterRouter from "./services/newsletter/newsletter-router.js";
import profileRouter from "./services/profile/profile-router.js";
import registrationRouter from "./services/registration/registration-router.js";
import s3Router from "./services/s3/s3-router.js";
import shopRouter from "./services/shop/shop-router.js";
import staffRouter from "./services/staff/staff-router.js";
import versionRouter from "./services/version/version-router.js";
import userRouter from "./services/user/user-router.js";

// import { InitializeConfigReader } from "./middleware/config-reader.js";
import { ErrorHandler } from "./middleware/error-handler.js";
import { StatusCode } from "status-code-enum";
import Config from "./config.js";
import database from "./middleware/database.js";

const app: Application = express();

// Utility packages (detailed in the readme)
// app.use(helmet({ crossOriginResourcePolicy: false }));

// Enable request output when not a test
if (!Config.TEST) {
    app.use(morgan("dev"));
}

// Automatically convert requests from json
app.use(express.json());

// Initialize database (IMPORTANT: must be before all routers)
app.use(database);

// Add routers for each sub-service
app.use("/admission/", admissionRouter);
app.use("/auth/", authRouter);
app.use("/event/", eventRouter);
app.use("/mail/", mailRouter);
app.use("/newsletter/", newsletterRouter);
app.use("/profile/", profileRouter);
app.use("/registration/", registrationRouter);
app.use("/s3/", s3Router);
app.use("/shop/", shopRouter);
app.use("/staff/", staffRouter);
app.use("/version/", versionRouter);
app.use("/user/", userRouter);

// Ensure that API is running
app.get("/", (_: Request, res: Response) => {
    res.end("API is working!!!");
});

// Throw an error if call is made to the wrong API endpoint
app.use("/", (_: Request, res: Response) => {
    res.status(StatusCode.ClientErrorNotFound).end("API endpoint does not exist!");
});

app.use(ErrorHandler);

function promiseListen(port: number): Promise<Express.Application> {
    return new Promise((resolve) => {
        const server = app.listen(port, () => {
            resolve(server);
        });
    });
}

export async function startServer(): Promise<Express.Application> {
    const port = Config.PORT;

    // Connect express server
    const server: Express.Application = await promiseListen(port);

    // Log success
    console.log(`✅ Server started on http://localhost:${port}...`);

    return server;
}

export default app;
