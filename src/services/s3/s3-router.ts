import { Request, Response, Router } from "express";
import { NextFunction } from "express-serve-static-core";
import { strongJwtVerification } from "../../middleware/verify-jwt.js";
import { JwtPayload } from "../auth/auth-models.js";
import { StatusCode } from "status-code-enum";
import { hasElevatedPerms } from "../auth/auth-lib.js";

import S3 from "aws-sdk/clients/s3.js";
import Config from "../../config.js";

const s3Router: Router = Router();

const s3 = new S3({
    apiVersion: "2006-03-01",
    accessKeyId: Config.S3_ACCESS_KEY,
    secretAccessKey: Config.S3_SECRET_KEY,
    region: Config.S3_REGION,
    signatureVersion: "v4",
});

/**
 * @api {get} /s3/upload GET /s3/upload
 * @apiGroup s3
 * @apiDescription Gets a presigned upload url to the resume s3 bucket for the currently authenticated user, valid for 60s.
 *
 * @apiSuccess (200: Success) {String} url presigned URL
 * 
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 * {
        "url": "https://resume-bucket-dev.s3.us-east-2.amazonaws.com/randomuser?randomstuffs",
   }
 */
s3Router.get("/upload", strongJwtVerification, async (_1: Request, res: Response, _2: NextFunction) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;
    const userId: string = payload.id;

    const s3Params = {
        Bucket: Config.S3_BUCKET_NAME,
        Key: userId,
        Expires: 60,
        ContentType: "application/pdf",
    };

    const uploadUrl = await s3.getSignedUrl("putObject", s3Params);

    return res.status(StatusCode.SuccessOK).send({ url: uploadUrl });
});

/**
 * @api {get} /s3/download GET /s3/download
 * @apiGroup s3
 * @apiDescription Gets a presigned download url for the resume of the currently authenticated user, valid for 60s.
 *
 * @apiSuccess (200: Success) {String} url presigned URL
 * 
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 * {
        "url": "https://resume-bucket-dev.s3.us-east-2.amazonaws.com/randomuser?randomstuffs",
   }
 */
s3Router.get("/download", strongJwtVerification, async (_1: Request, res: Response, _2: NextFunction) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;
    const userId: string = payload.id;

    const s3Params = {
        Bucket: Config.S3_BUCKET_NAME,
        Key: userId,
        Expires: 60,
    };

    const downloadUrl = await s3.getSignedUrl("getObject", s3Params);

    return res.status(StatusCode.SuccessOK).send({ url: downloadUrl });
});

/**
 * @api {get} /s3/download/:USERID GET /s3/download/:USERID
 * @apiGroup s3
 * @apiDescription Gets a presigned download url for the resume of the specified user, given that the caller has elevated perms
 *
 * @apiSuccess (200: Success) {String} url presigned URL
 * 
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 * {
        "url": "https://resume-bucket-dev.s3.us-east-2.amazonaws.com/randomuser?randomstuffs",
   }
 * @apiError (403: Forbidden) {String} Forbidden
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 403 Forbidden
 *     {"error": "Forbidden"}
 */
s3Router.get("/download/:USERID", strongJwtVerification, async (req: Request, res: Response, _2: NextFunction) => {
    const userId: string | undefined = req.params.USERID;
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    if (!hasElevatedPerms(payload)) {
        return res.status(StatusCode.ClientErrorForbidden).send({ error: "Forbidden" });
    }

    const s3Params = {
        Bucket: Config.S3_BUCKET_NAME,
        Key: userId,
        Expires: 60,
    };

    const downloadUrl = await s3.getSignedUrl("getObject", s3Params);

    return res.status(StatusCode.SuccessOK).send({ url: downloadUrl });
});

export default s3Router;
