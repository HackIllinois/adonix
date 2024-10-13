import { Request, Response, Router } from "express";
import { strongJwtVerification } from "../../middleware/verify-jwt";
import { JwtPayload } from "../auth/auth-schemas";
import { StatusCode } from "status-code-enum";
import { hasElevatedPerms } from "../../common/auth";
import { createSignedPostUrl, getSignedDownloadUrl } from "./s3-service";

const s3Router = Router();

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
s3Router.get("/upload/", strongJwtVerification, async (_req: Request, res: Response) => {
    const payload = res.locals.payload as JwtPayload;
    const userId = payload.id;

    const { url, fields } = await createSignedPostUrl(userId);

    return res.status(StatusCode.SuccessOK).send({ url: url, fields: fields });
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
s3Router.get("/download/", strongJwtVerification, async (_req: Request, res: Response) => {
    const payload = res.locals.payload as JwtPayload;
    const userId = payload.id;
    const downloadUrl = getSignedDownloadUrl(userId);

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
s3Router.get("/download/:USERID", strongJwtVerification, async (req: Request, res: Response) => {
    const userId = req.params.USERID as string;
    const payload = res.locals.payload as JwtPayload;

    if (!hasElevatedPerms(payload)) {
        return res.status(StatusCode.ClientErrorForbidden).send({ error: "Forbidden" });
    }

    const downloadUrl = await getSignedDownloadUrl(userId);

    return res.status(StatusCode.SuccessOK).send({ url: downloadUrl });
});

export default s3Router;
