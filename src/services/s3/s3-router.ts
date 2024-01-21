import { Request, Response, Router } from "express";
import { strongJwtVerification } from "../../middleware/verify-jwt.js";
import { JwtPayload } from "../auth/auth-models.js";
import { StatusCode } from "status-code-enum";
import { hasElevatedPerms } from "../auth/auth-lib.js";

import Config from "../../config.js";
import { PutObjectCommand, type S3 } from "@aws-sdk/client-s3";
import { s3ClientMiddleware } from "../../middleware/s3.js";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Router: Router = Router();

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
s3Router.get("/upload", strongJwtVerification, s3ClientMiddleware, async (_req: Request, res: Response) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;
    const s3 = res.locals.s3 as S3;
    const userId: string = payload.id;

    const command = new PutObjectCommand({
        Bucket: Config.S3_BUCKET_NAME,
        Key: `${userId}.pdf`,
        ContentType: "application/pdf",
    });
    const uploadUrl = await getSignedUrl(s3, command, {
        expiresIn: Config.RESUME_URL_EXPIRY_SECONDS,
    });

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
s3Router.get("/download", strongJwtVerification, s3ClientMiddleware, async (_req: Request, res: Response) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;
    const s3 = res.locals.s3 as S3;
    const userId: string = payload.id;

    const command = new PutObjectCommand({
        Bucket: Config.S3_BUCKET_NAME,
        Key: `${userId}.pdf`,
    });

    const downloadUrl = await getSignedUrl(s3, command, {
        expiresIn: Config.RESUME_URL_EXPIRY_SECONDS,
    });

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
s3Router.get("/download/:USERID", strongJwtVerification, s3ClientMiddleware, async (req: Request, res: Response) => {
    const userId: string | undefined = req.params.USERID;
    const payload: JwtPayload = res.locals.payload as JwtPayload;
    const s3 = res.locals.s3 as S3;

    if (!hasElevatedPerms(payload)) {
        return res.status(StatusCode.ClientErrorForbidden).send({ error: "Forbidden" });
    }

    const command = new PutObjectCommand({
        Bucket: Config.S3_BUCKET_NAME,
        Key: `${userId}.pdf`,
    });

    const downloadUrl = await getSignedUrl(s3, command, {
        expiresIn: Config.RESUME_URL_EXPIRY_SECONDS,
    });

    return res.status(StatusCode.SuccessOK).send({ url: downloadUrl });
});

export default s3Router;
