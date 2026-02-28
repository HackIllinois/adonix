import { Router } from "express";
import { StatusCode } from "status-code-enum";
import { z } from "zod";
import Models from "../../common/models";
import specification, { Tag } from "../../middleware/specification";
import { Role } from "../auth/auth-schemas";
import {
    JudgeMongoIdSchema,
    JudgeNotFoundError,
    JudgeNotFoundErrorSchema,
    JudgeProfileCreateRequestSchema,
    JudgeProfileSchema,
} from "./judge-schemas";
import { SuccessResponseSchema } from "../../common/schemas";

const judgeRouter = Router();

function serializeJudgeProfile(profile: { _id: unknown; name: string; description: string; imageUrl: string }): {
    _id: string;
    name: string;
    description: string;
    imageUrl: string;
} {
    return {
        _id: String(profile._id),
        name: profile.name,
        description: profile.description,
        imageUrl: profile.imageUrl,
    };
}

judgeRouter.post(
    "/info/",
    specification({
        method: "post",
        path: "/judge/info/",
        tag: Tag.JUDGE,
        role: Role.STAFF,
        summary: "Creates a judge profile",
        body: JudgeProfileCreateRequestSchema,
        responses: {
            [StatusCode.SuccessCreated]: {
                description: "The created judge profile",
                schema: JudgeProfileSchema,
            },
        },
    }),
    async (req, res) => {
        const { name, description, imageUrl } = req.body;
        const judgeProfile = {
            name,
            description,
            imageUrl,
        };

        const created = await Models.JudgeProfile.create(judgeProfile);
        return res.status(StatusCode.SuccessCreated).send(serializeJudgeProfile(created));
    },
);

judgeRouter.get(
    "/info/",
    specification({
        method: "get",
        path: "/judge/info/",
        tag: Tag.JUDGE,
        role: null,
        summary: "Gets all judge profiles",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The judge profiles",
                schema: z.array(JudgeProfileSchema),
            },
        },
    }),
    async (_req, res) => {
        const judges = await Models.JudgeProfile.find().sort({ name: 1 });
        return res.status(StatusCode.SuccessOK).send(judges.map(serializeJudgeProfile));
    },
);

judgeRouter.put(
    "/info/:id/",
    specification({
        method: "put",
        path: "/judge/info/{id}/",
        tag: Tag.JUDGE,
        role: Role.STAFF,
        summary: "Updates a judge profile",
        parameters: z.object({
            id: JudgeMongoIdSchema,
        }),
        body: JudgeProfileCreateRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The updated judge profile",
                schema: JudgeProfileSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Failed to find the judge requested",
                schema: JudgeNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id } = req.params;
        const { name, description, imageUrl } = req.body;

        const updated = await Models.JudgeProfile.findByIdAndUpdate(id, { name, description, imageUrl }, { new: true });
        if (!updated) {
            return res.status(StatusCode.ClientErrorNotFound).send(JudgeNotFoundError);
        }

        return res.status(StatusCode.SuccessOK).send(serializeJudgeProfile(updated));
    },
);

judgeRouter.delete(
    "/info/:id/",
    specification({
        method: "delete",
        path: "/judge/info/{id}/",
        tag: Tag.JUDGE,
        role: Role.STAFF,
        summary: "Deletes a judge profile",
        parameters: z.object({
            id: JudgeMongoIdSchema,
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Successfully deleted",
                schema: SuccessResponseSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Failed to find the judge requested",
                schema: JudgeNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id } = req.params;
        const result = await Models.JudgeProfile.findByIdAndDelete(id);
        if (!result) {
            return res.status(StatusCode.ClientErrorNotFound).send(JudgeNotFoundError);
        }

        return res.status(StatusCode.SuccessOK).send({ success: true });
    },
);

export default judgeRouter;
