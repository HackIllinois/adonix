import { Router } from "express";
import { Role } from "../auth/auth-schemas";
import { StatusCode } from "status-code-enum";
import { getAuthenticatedUser } from "../../common/auth";
import { createSignedPostUrl, getSignedDownloadUrl } from "./s3-service";
import specification, { Tag } from "../../middleware/specification";
import Config from "../../common/config";
import { S3DownloadURLSchema, S3UploadURLSchema } from "./s3-schemas";
import { UserIdSchema } from "../../common/schemas";
import { z } from "zod";

const s3Router = Router();

s3Router.get(
    "/upload/",
    specification({
        method: "get",
        path: "/s3/upload/",
        tag: Tag.S3,
        role: Role.USER,
        summary: "Gets a upload url for the resume of the currently authenticated user",
        description: `This is a presigned url from s3 that is valid for ${Config.RESUME_URL_EXPIRY_SECONDS} seconds`,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The upload url",
                schema: S3UploadURLSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);
        const { url, fields } = await createSignedPostUrl(userId);
        return res.status(StatusCode.SuccessOK).send({ url, fields });
    },
);

s3Router.get(
    "/download/",
    specification({
        method: "get",
        path: "/s3/download/",
        tag: Tag.S3,
        role: Role.USER,
        summary: "Gets a download url for the resume of the currently authenticated user",
        description: `This is a presigned url from s3 that is valid for ${Config.RESUME_URL_EXPIRY_SECONDS} seconds`,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The download url",
                schema: S3DownloadURLSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);
        const downloadUrl = await getSignedDownloadUrl(userId);
        return res.status(StatusCode.SuccessOK).send({ url: downloadUrl });
    },
);

s3Router.get(
    "/download/:id",
    specification({
        method: "get",
        path: "/s3/download/{id}",
        tag: Tag.S3,
        role: Role.ADMIN,
        summary: "Gets a download url for the resume of the specified user",
        description:
            "Admin-only because this is for a specific user, use `GET /s3/download/` for the currently authenticated user",
        parameters: z.object({
            id: UserIdSchema,
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The download url",
                schema: S3DownloadURLSchema,
            },
        },
    }),
    async (req, res) => {
        const userId = req.params.id;

        const downloadUrl = await getSignedDownloadUrl(userId);

        return res.status(StatusCode.SuccessOK).send({ url: downloadUrl });
    },
);

export default s3Router;
