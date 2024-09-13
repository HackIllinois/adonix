import "./types";
import morgan from "morgan";
import express, { Request, Response } from "express";
import swaggerUi from "swagger-ui-express";

import admissionRouter from "./services/admission/admission-router";
import authRouter from "./services/auth/auth-router";
import eventRouter from "./services/event/event-router";
import mailRouter from "./services/mail/mail-router";
import mentorRouter from "./services/mentor/mentor-router";
import newsletterRouter from "./services/newsletter/newsletter-router";
import notificationRouter from "./services/notification/notification-router";
import profileRouter from "./services/profile/profile-router";
import puzzleRouter from "./services/puzzle/puzzle-router";
import registrationRouter from "./services/registration/registration-router";
import s3Router from "./services/s3/s3-router";
import shopRouter from "./services/shop/shop-router";
import staffRouter from "./services/staff/staff-router";
import versionRouter from "./services/version/version-router";
import userRouter from "./services/user/user-router";

// import { InitializeConfigReader } from "./middleware/config-reader";
import { ErrorHandler } from "./middleware/error-handler";
import { StatusCode } from "status-code-enum";
import Config from "./config";
import database from "./middleware/database";
import corsSelector from "./middleware/cors-selector";
import { getOpenAPISpec } from "./openapi";

const app = express();

// Utility packages (detailed in the readme)
app.use(corsSelector);

// Enable request output when not a test
if (!Config.TEST) {
    app.use(morgan("dev"));
}

// Automatically convert requests from json
app.use(express.json());
// eslint-disable-next-line no-magic-numbers
app.set("json spaces", 4);

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

// Docs
app.use("/docs/json", (_req, res) => res.json(getOpenAPISpec()));
app.use(
    "/docs",
    swaggerUi.serveFiles(undefined, {
        swaggerUrl: `${Config.ROOT_URL}/docs/json`,
    }),
    swaggerUi.setup(undefined, {
        swaggerUrl: `${Config.ROOT_URL}/docs/json`,
    }),
);

// Ensure that API is running
app.get("/", (_: Request, res: Response) => {
    res.json({
        ok: true,
        info: "Welcome to HackIllinois' backend API!",
        docs: `${Config.ROOT_URL}/docs/`,
    });
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
    const server = await promiseListen(port);

    // Log success
    console.log(`✅ Server started on http://localhost:${port}...`);

    return server;
}

export default app;
