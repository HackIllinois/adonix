import { Router } from "express";
import { Request, Response } from "express-serve-static-core";
import Metadata from "../../metadata.js";
import { StatusCode } from "status-code-enum";

const versionRouter: Router = Router();

/**
 * @api {get} /version/android/ GET /version/android/
 * @apiGroup Version
 * @apiDescription Get the latest Android app version.
 *
 * @apiSuccess (200: Success) {Json} version The latest Android app version.
 * @apiSuccessExample Example Success Response
 * HTTP/1.1 200 OK
 * {
 *   "version": "2024.1.1"
 * }
 */

versionRouter.get("/android/", async (_: Request, res: Response) => {
    const androidVersion: string = await Metadata.load("androidVersion");
    res.status(StatusCode.SuccessOK).send({ version: androidVersion });
});

/**
 * @api {get} /version/ios/ GET /version/ios/
 * @apiGroup Version
 * @apiDescription Get the latest iOS app version.
 *
 * @apiSuccess (200: Success) {Json} version The latest iOS app version.
 * @apiSuccessExample Example Success Response
 * HTTP/1.1 200 OK
 * {
 *   "version": "2024.1.1"
 * }
 */
versionRouter.get("/ios/", async (_: Request, res: Response) => {
    const iosVersion: string = await Metadata.load("iosVersion");
    res.status(StatusCode.SuccessOK).send({ version: iosVersion });
});

export default versionRouter;
