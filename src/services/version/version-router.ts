import { Router } from "express";
import { StatusCode } from "status-code-enum";
import specification, { Tag } from "../../middleware/specification";
import { VersionResponseSchema, VersionSchema } from "./version-schema";
import RuntimeConfig from "../../common/runtimeConfig";
import { z } from "zod";
import { SuccessResponseSchema } from "../../common/schemas";
import { Role } from "../auth/auth-schemas";

const versionRouter = Router();

versionRouter.get(
    "/android/",
    specification({
        method: "get",
        path: "/version/android/",
        tag: Tag.VERSION,
        role: null,
        summary: "Gets the current android version",
        description: "Note that this version can be set on the admin site",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The current version",
                schema: VersionResponseSchema,
            },
        },
    }),
    async (_, res) => {
        const androidVersion = await RuntimeConfig.get("androidVersion");
        res.status(StatusCode.SuccessOK).send({ version: androidVersion });
    },
);

versionRouter.get(
    "/ios/",
    specification({
        method: "get",
        path: "/version/ios/",
        tag: Tag.VERSION,
        role: null,
        summary: "Gets the current ios version",
        description: "Note that this version can be set on the admin site",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The current version",
                schema: VersionResponseSchema,
            },
        },
    }),
    async (_, res) => {
        const iosVersion = await RuntimeConfig.get("iosVersion");
        res.status(StatusCode.SuccessOK).send({ version: iosVersion });
    },
);

versionRouter.post(
    "/android/:version/",
    specification({
        method: "post",
        path: "/version/android/{version}/",
        tag: Tag.VERSION,
        role: Role.ADMIN,
        summary: "Sets the current android version",
        parameters: z.object({
            version: VersionSchema,
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Successfully set",
                schema: SuccessResponseSchema,
            },
        },
    }),
    async (req, res) => {
        const { version } = req.params;
        await RuntimeConfig.set("androidVersion", version);
        res.status(StatusCode.SuccessOK).send({ success: true });
    },
);

versionRouter.post(
    "/ios/:version/",
    specification({
        method: "post",
        path: "/version/ios/{version}/",
        tag: Tag.VERSION,
        role: Role.ADMIN,
        summary: "Sets the current ios version",
        parameters: z.object({
            version: VersionSchema,
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Successfully set",
                schema: SuccessResponseSchema,
            },
        },
    }),
    async (req, res) => {
        const { version } = req.params;
        await RuntimeConfig.set("iosVersion", version);
        res.status(StatusCode.SuccessOK).send({ success: true });
    },
);

export default versionRouter;
