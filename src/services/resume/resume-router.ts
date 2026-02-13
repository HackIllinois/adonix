import { Router } from "express";
import { Role } from "../auth/auth-schemas";
import { StatusCode } from "status-code-enum";
import { getAuthenticatedUser } from "../../common/auth";
import { createSignedResumePostUrl, getSignedResumeDownloadUrl, getSignedResumeDownloadUrlList } from "./resume-service";
import specification, { Tag } from "../../middleware/specification";
import Config from "../../common/config";
import {
    ResumeDownloadURLSchema,
    ResumeUploadURLSchema,
    BatchResumeDownloadListSchema,
    ResumeListDownloadURLSchema,
} from "./resume-schemas";
import { UserIdSchema } from "../../common/schemas";
import { z } from "zod";

const resumeRouter = Router();

resumeRouter.get(
    "/upload/",
    specification({
        method: "get",
        path: "/resume/upload/",
        tag: Tag.RESUME,
        role: Role.USER,
        summary: "Gets a upload url for the resume of the currently authenticated user",
        description: `This is a presigned url from s3 that is valid for ${Config.RESUME_URL_EXPIRY_SECONDS} seconds`,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The upload url",
                schema: ResumeUploadURLSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);
        const { url, fields } = await createSignedResumePostUrl(userId);
        return res.status(StatusCode.SuccessOK).send({ url, fields });
    },
);

resumeRouter.get(
    "/download/",
    specification({
        method: "get",
        path: "/resume/download/",
        tag: Tag.RESUME,
        role: Role.USER,
        summary: "Gets a download url for the resume of the currently authenticated user",
        description: `This is a presigned url from s3 that is valid for ${Config.RESUME_URL_EXPIRY_SECONDS} seconds`,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The download url",
                schema: ResumeDownloadURLSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);
        const downloadUrl = await getSignedResumeDownloadUrl(userId);
        return res.status(StatusCode.SuccessOK).send({ url: downloadUrl });
    },
);

resumeRouter.get(
    "/download/:id",
    specification({
        method: "get",
        path: "/resume/download/{id}",
        tag: Tag.RESUME,
        role: [Role.SPONSOR, Role.ADMIN],
        summary: "Gets a download url for the resume of the specified user",
        description:
            "This is for a specific user and requires higher permissions, use `GET /resume/download/` for the currently authenticated user",
        parameters: z.object({
            id: UserIdSchema,
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The download url",
                schema: ResumeDownloadURLSchema,
            },
        },
    }),
    async (req, res) => {
        const userId = req.params.id;

        const downloadUrl = await getSignedResumeDownloadUrl(userId);

        return res.status(StatusCode.SuccessOK).send({ url: downloadUrl });
    },
);

resumeRouter.post(
    "/batch-download/",
    specification({
        method: "post",
        path: "/resume/batch-download/",
        tag: Tag.RESUME,
        role: [Role.SPONSOR, Role.ADMIN],
        summary: "Gets a download url for all the resumes",
        body: BatchResumeDownloadListSchema,
        description: `List of presigned urls from s3 that is valid for ${Config.RESUME_URL_EXPIRY_SECONDS} seconds`,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "List of download urls",
                schema: ResumeListDownloadURLSchema,
            },
        },
    }),
    async (req, res) => {
        const { userIds } = req.body;

        const urls = await getSignedResumeDownloadUrlList(userIds);
        return res.status(StatusCode.SuccessOK).send({ urls: urls });
    },
);

export default resumeRouter;
