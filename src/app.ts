import "./common/init";
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
import resumeRouter from "./services/resume/resume-router";
import shopRouter from "./services/shop/shop-router";
import staffRouter from "./services/staff/staff-router";
import versionRouter from "./services/version/version-router";
import userRouter from "./services/user/user-router";
import sponsorRouter from "./services/sponsor/sponsor-router";
import statisticRouter from "./services/statistic/statistic-router";

// import { InitializeConfigReader } from "./middleware/config-reader";
import { ErrorHandler } from "./middleware/error-handler";
import { StatusCode } from "status-code-enum";
import Config from "./common/config";
import database from "./middleware/database";
import corsSelector from "./middleware/cors-selector";
import { getOpenAPISpec, SWAGGER_UI_OPTIONS } from "./common/openapi";
import { tryGetAuthenticatedUser } from "./common/auth";
import { initializeDatabase } from "./common/models";
import { initializeStatisticLogging } from "./services/statistic/statistic-lib";

const app = express();

// Trust proxy for ECS
app.enable("trust proxy");

// Utility packages (detailed in the readme)
app.use(corsSelector);

// Enable request output when not a test
if (!Config.TEST) {
    // Adds user id as "id" so we can log it with requests
    morgan.token("id", function (req, _res) {
        return tryGetAuthenticatedUser(req)?.id || "unauthenticated";
    });
    app.use(morgan(":status :method :url :id :remote-addr :response-time ms :res[content-length] bytes"));
}

// Automatically convert requests from json and limit request size
app.use(express.json({ limit: Config.MAX_REQUEST_SIZE_BYTES })); // JSON payloads
app.use(express.raw({ limit: Config.MAX_REQUEST_SIZE_BYTES })); // Raw binary data
app.use(express.text({ limit: Config.MAX_REQUEST_SIZE_BYTES })); // Plain text

// eslint-disable-next-line no-magic-numbers
app.set("json spaces", 4);

// Setup database on app request
app.use(database);

// Add routers for each sub-service
app.use("/admission/", admissionRouter);
app.use("/auth/", authRouter);
app.use("/event/", eventRouter);
app.use("/mail/", mailRouter);
app.use("/mentor/", mentorRouter);
app.use("/newsletter/", newsletterRouter);
app.use("/notification/", notificationRouter);
app.use("/profile/", profileRouter);
app.use("/puzzle/", puzzleRouter);
app.use("/registration/", registrationRouter);
app.use("/resume/", resumeRouter);
app.use("/shop/", shopRouter);
app.use("/sponsor/", sponsorRouter);
app.use("/staff/", staffRouter);
app.use("/statistic/", statisticRouter);
app.use("/version/", versionRouter);
app.use("/user/", userRouter);

// Docs
app.use("/docs/json", async (_req, res) => res.json(await getOpenAPISpec()));
app.use("/docs", swaggerUi.serveFiles(undefined, SWAGGER_UI_OPTIONS), swaggerUi.setup(undefined, SWAGGER_UI_OPTIONS));

// Basic status endpoints
const docsUrl = `${Config.ROOT_URL}/docs/`;
function statusHandler(_: Request, res: Response): void {
    res.json({
        ok: true,
        version: Config.VERSION,
        info: "Welcome to HackIllinois' backend API!",
        docs: docsUrl,
    });
}
app.get("/", statusHandler);
app.get("/status/", statusHandler);

// Throw an error if call is made to the wrong API endpoint
app.use("/", (_: Request, res: Response) => {
    res.status(StatusCode.ClientErrorNotFound).json({
        error: "EndpointNotFound",
        message: "This endpoint doesn't exist, see the docs!",
        docs: docsUrl,
    });
});

// Handle any errors from the above
app.use(ErrorHandler);

// Finally, a function to start the server
function promiseListen(port: number): Promise<Express.Application> {
    return new Promise((resolve) => {
        const server = app.listen(port, () => {
            resolve(server);
        });
    });
}

export async function startServer(): Promise<Express.Application> {
    const port = Config.PORT;

    // Connect database
    await initializeDatabase();

    // Start logging
    initializeStatisticLogging();

    // Connect express server
    const server = await promiseListen(port);

    // Log success
    console.log(`✅ Server started on http://localhost:${port}...`);

    return server;
}

export default app;
