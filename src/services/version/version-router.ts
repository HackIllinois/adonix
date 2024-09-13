import { Router } from "express";
import Metadata from "../../metadata";
import { StatusCode } from "status-code-enum";
import specification, { Tag } from "../../middleware/specification";
import { versionResponseSchema } from "./version-schema";

const versionRouter = Router();

versionRouter.get(
    "/android/",
    specification({
        method: "get",
        path: "/version/android/",
        tag: Tag.VERSION,
        summary: "Gets the current android version",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The current version",
                schema: versionResponseSchema,
            },
        },
    }),
    async (_, res) => {
        const androidVersion = await Metadata.load("androidVersion");
        res.status(StatusCode.SuccessOK).send({ version: androidVersion });
    },
);

versionRouter.get(
    "/ios/",
    specification({
        method: "get",
        path: "/version/ios/",
        tag: Tag.VERSION,
        summary: "Gets the current ios version",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The current version",
                schema: versionResponseSchema,
            },
        },
    }),
    async (_, res) => {
        const iosVersion = await Metadata.load("iosVersion");
        res.status(StatusCode.SuccessOK).send({ version: iosVersion });
    },
);

export default versionRouter;
