import { Router } from "express";
import { StatusCode } from "status-code-enum";
import { Role } from "../auth/auth-schemas";
import { z } from "zod";
import specification, { Tag } from "../../middleware/specification";
import Models from "../../common/models";
import {
    CTFAlreadyClaimedError,
    CTFAlreadyClaimedErrorSchema,
    CTFSolveFailedError,
    CTFSolveFailedErrorSchema,
    FlagCreateRequestSchema,
    FlagNotFoundError,
    FlagNotFoundErrorSchema,
    FlagSchema,
} from "./ctf-schemas";
import { getAuthenticatedUser } from "../../common/auth";
import { updatePoints } from "../profile/profile-lib";

const CTFRouter = Router();

CTFRouter.post(
    "/",
    specification({
        method: "post",
        path: "/ctf/",
        tag: Tag.CTF,
        role: Role.ADMIN,
        summary: "Creates a new CTF flag",
        body: FlagCreateRequestSchema,
        responses: {
            [StatusCode.SuccessCreated]: {
                description: "The created CTF flag",
                schema: FlagSchema,
            },
        },
    }),
    async (req, res) => {
        const flag = await Models.Flag.create(req.body);
        return res.status(StatusCode.SuccessCreated).json(flag);
    },
);

CTFRouter.get(
    "/",
    specification({
        method: "get",
        path: "/ctf/",
        tag: Tag.CTF,
        role: Role.STAFF,
        summary: "Retrieves all CTF flags",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The list of CTF flags",
                schema: FlagSchema.array(),
            },
        },
    }),
    async (_req, res) => {
        const flags = await Models.Flag.find();
        return res.status(StatusCode.SuccessOK).json(flags);
    },
);

CTFRouter.delete(
    "/:id/",
    specification({
        method: "delete",
        path: "/ctf/{id}/",
        tag: Tag.CTF,
        role: Role.ADMIN,
        summary: "Deletes a CTF flag",
        parameters: z.object({
            id: z.string(),
        }),
        responses: {
            [StatusCode.SuccessNoContent]: {
                description: "The deleted CTF flag",
                schema: z.object({}).openapi({ description: "Empty response" }),
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Failed to find flag",
                schema: FlagNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const flag = await Models.Flag.findOneAndDelete({ flagId: req.params.id });
        if (!flag) {
            return res.status(StatusCode.ClientErrorNotFound).send(FlagNotFoundError);
        }
        return res.status(StatusCode.SuccessNoContent).json();
    },
);

CTFRouter.post(
    "/submit/:id/",
    specification({
        method: "post",
        path: "/ctf/submit/{id}/",
        tag: Tag.CTF,
        role: Role.USER,
        summary: "Submits an answer for a CTF flag",
        parameters: z.object({
            id: z.string(),
        }),
        body: z.object({
            answer: z.string(),
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The submitted answer is correct",
                schema: FlagSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Failed to find flag",
                schema: FlagNotFoundErrorSchema,
            },
            [StatusCode.ClientErrorBadRequest]: [
                {
                    id: CTFSolveFailedError.error,
                    description: "The submitted flag is incorrect",
                    schema: CTFSolveFailedErrorSchema,
                },
                {
                    id: CTFAlreadyClaimedError.error,
                    description: "The flag has already been claimed",
                    schema: CTFAlreadyClaimedErrorSchema,
                },
            ],
        },
    }),
    async (req, res) => {
        const { id } = req.params;
        const { answer } = req.body;

        const flag = await Models.Flag.findOne({ flagId: id });
        if (!flag) {
            return res.status(StatusCode.ClientErrorNotFound).send(FlagNotFoundError);
        }

        if (flag.flag !== answer) {
            return res.status(StatusCode.ClientErrorBadRequest).send(CTFSolveFailedError);
        }

        const user = getAuthenticatedUser(req).id;
        const alreadyClaimed = await Models.FlagsClaimed.findOne({ userId: user, flagId: flag.flagId });
        if (alreadyClaimed) {
            return res.status(StatusCode.ClientErrorBadRequest).send(CTFAlreadyClaimedError);
        }
        await Models.FlagsClaimed.create({ userId: user, flagId: flag.flagId });
        await updatePoints(user, flag.points);
        return res.status(StatusCode.SuccessOK).json(flag);
    },
);

export default CTFRouter;
