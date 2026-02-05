import { Router } from "express";
import { StatusCode } from "status-code-enum";
import { z } from "zod";
import { Role } from "../auth/auth-schemas";
import specification, { Tag } from "../../middleware/specification";
import Models from "../../common/models";

import {
    DuelSchema,
    DuelCreateRequestSchema,
    MaxDuelsExceededError,
    MaxDuelsExceededErrorSchema,
    DuelIdSchema,
    DuelNotFoundError,
    DuelNotFoundErrorSchema,
    DuelUpdateRequestSchema,
} from "./duel-schemas";
import { SuccessResponseSchema } from "../../common/schemas";
import { isValidObjectId } from "mongoose";
import { checkGameStatus } from "./duel-lib";
import { getAuthenticatedUser } from "../../common/auth";

const duelRouter = Router();

duelRouter.post(
    "/",
    specification({
        method: "post",
        path: "/duel/",
        tag: Tag.DUEL,
        role: Role.USER,
        summary: "Initiates a duel between two users",
        body: DuelCreateRequestSchema,
        responses: {
            [StatusCode.SuccessCreated]: {
                description: "The created duel",
                schema: DuelSchema,
            },
            [StatusCode.ClientErrorConflict]: {
                description: "Maximum number of duels between these users has been exceeded.",
                schema: MaxDuelsExceededErrorSchema,
            },
        },
    }),
    async (req, res) => {
        // Enforces maximum of 5 duels between any two users
        const existingDuels = await Models.Duel.find({
            $or: [
                { hostId: req.body.hostId, guestId: req.body.guestId },
                { hostId: req.body.guestId, guestId: req.body.hostId },
            ],
        });

        if (existingDuels.length >= 5) {
            return res.status(StatusCode.ClientErrorConflict).send(MaxDuelsExceededError);
        }
        const duel = await Models.Duel.create(req.body);
        return res.status(StatusCode.SuccessCreated).json(duel.toObject());
    },
);

duelRouter.get(
    "/:id/",
    specification({
        method: "get",
        path: "/duel/{id}/",
        tag: Tag.DUEL,
        role: Role.USER,
        summary: "Gets a duel",
        parameters: z.object({
            id: DuelIdSchema,
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The requested duel",
                schema: DuelSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "The requested duel was not found.",
                schema: DuelNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: duelId } = req.params;

        if (!isValidObjectId(duelId)) {
            return res.status(StatusCode.ClientErrorNotFound).send(DuelNotFoundError);
        }

        const duel = await Models.Duel.findById(duelId);
        if (!duel) {
            return res.status(StatusCode.ClientErrorNotFound).send(DuelNotFoundError);
        }

        return res.status(StatusCode.SuccessOK).send(duel.toObject());
    },
);

duelRouter.put(
    "/:id/",
    specification({
        method: "put",
        path: "/duel/{id}/",
        tag: Tag.DUEL,
        role: Role.USER,
        summary: "Updates a duel only if both users submit matching changes",
        parameters: z.object({
            id: DuelIdSchema,
        }),
        body: DuelUpdateRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The updated duel",
                schema: DuelSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "The requested duel was not found.",
                schema: DuelNotFoundErrorSchema,
            },
            [StatusCode.SuccessAccepted]: {
                description: "Update pending confirmation",
                schema: DuelSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: duelId } = req.params;
        const sender = getAuthenticatedUser(req).id;
        const updatePayload = JSON.stringify(req.body);

        const duel = await Models.Duel.findById(duelId);
        if (!duel) {
            return res.status(StatusCode.ClientErrorNotFound).send(DuelNotFoundError);
        }

        const isHost = sender === duel.hostId;
        const self: "host" | "guest" = isHost ? "host" : "guest";
        const opp: "host" | "guest" = isHost ? "guest" : "host";

        // If the update is not pending from opp, add it to user's pendingUpdates
        if (!duel.pendingUpdates[opp].includes(updatePayload)) {
            duel.pendingUpdates[self].push(updatePayload);
            await duel.save();
            return res.status(StatusCode.SuccessAccepted).send(duel);
        }

        // If the update is pending from opp, apply it and remove from pendingUpdates
        duel.pendingUpdates[opp] = duel.pendingUpdates[opp].filter((u) => u !== updatePayload);
        Object.assign(duel, req.body);
        await duel.save();
        checkGameStatus(duelId, duel);
        return res.status(StatusCode.SuccessOK).send(duel);
    },
);

duelRouter.delete(
    "/:id/",
    specification({
        method: "delete",
        path: "/duel/{id}/",
        tag: Tag.DUEL,
        role: Role.ADMIN,
        summary: "Deletes a duel",
        parameters: z.object({
            id: DuelIdSchema,
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The duel was deleted",
                schema: SuccessResponseSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "The requested duel was not found.",
                schema: DuelNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: duelId } = req.params;

        const duel = await Models.Duel.findById(duelId);
        if (!duel) {
            return res.status(StatusCode.ClientErrorNotFound).send(DuelNotFoundError);
        }

        await Models.Duel.findByIdAndDelete(duelId);
        return res.status(StatusCode.SuccessOK).send({ success: true });
    },
);

export default duelRouter;
