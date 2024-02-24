// import morgan from "morgan";
import express, { Application, Request, Response } from "express";

import admissionRouter from "./services/admission/admission-router.js";
import authRouter from "./services/auth/auth-router.js";
import eventRouter from "./services/event/event-router.js";
import mailRouter from "./services/mail/mail-router.js";
import mentorRouter from "./services/mentor/mentor-router.js";
import newsletterRouter from "./services/newsletter/newsletter-router.js";
import notificationRouter from "./services/notification/notification-router.js";
import profileRouter from "./services/profile/profile-router.js";
import puzzleRouter from "./services/puzzle/puzzle-router.js";
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
import corsSelector from "./middleware/cors-selector.js";

const app: Application = express();

// Utility packages (detailed in the readme)
app.use(corsSelector);

// Enable request output when not a test
if (!Config.TEST) {
    // app.use(morgan("dev"));
}

// Automatically convert requests from json
app.use(express.json());

// Add routers for each sub-service
// NOTE: only include database middleware if needed
app.use("/admission/", database, admissionRouter);
app.use("/auth/", database, authRouter);
app.use("/event/", database, eventRouter);
app.use("/mail/", database, mailRouter);
app.use("/mentor/", database, mentorRouter);
app.use("/newsletter/", database, newsletterRouter);
app.use("/notification/", database, notificationRouter);
app.use("/profile/", database, profileRouter);
app.use("/puzzle/", database, puzzleRouter);
app.use("/registration/", database, registrationRouter);
app.use("/s3/", s3Router);
app.use("/shop/", database, shopRouter);
app.use("/staff/", database, staffRouter);
app.use("/version/", versionRouter);
app.use("/user/", database, userRouter);

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
