import { Router } from "express";
import { StatusCode } from "status-code-enum";
import Models from "../../common/models";
import { Role } from "../auth/auth-schemas";
import {
    PuzzleAnswerRequestSchema,
    PuzzleCreateRequestSchema,
    PuzzleIncorrectAnswerError,
    PuzzleIncorrectAnswerErrorSchema,
    PuzzleItem,
    PuzzleNotCreatedError,
    PuzzleNotCreatedErrorSchema,
    PuzzleQuestionIdSchema,
    PuzzleQuestionNotFoundError,
    PuzzleQuestionNotFoundErrorSchema,
    PuzzleSchema,
} from "./puzzle-schemas";
import Config from "../../common/config";
import specification, { Tag } from "../../middleware/specification";
import { getAuthenticatedUser } from "../../common/auth";
import { z } from "zod";

const puzzleRouter = Router();

puzzleRouter.get(
    "/status",
    specification({
        method: "get",
        path: "/puzzle/status/",
        tag: Tag.PUZZLE,
        role: Role.USER,
        summary: "Gets the status on the currently authenticated user's puzzle",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The status",
                schema: PuzzleSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "The user's puzzle hasn't been created yet",
                schema: PuzzleNotCreatedErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);

        const puzzle = await Models.PuzzleItem.findOne({ userId });

        if (!puzzle) {
            return res.status(StatusCode.ClientErrorNotFound).send(PuzzleNotCreatedError);
        }

        return res.status(StatusCode.SuccessOK).send(puzzle);
    },
);

puzzleRouter.post(
    "/submit/:qid/",
    specification({
        method: "post",
        path: "/puzzle/submit/{qid}/",
        tag: Tag.PUZZLE,
        role: Role.USER,
        summary: "Submits an answer to a specific question",
        parameters: z.object({
            qid: PuzzleQuestionIdSchema,
        }),
        body: PuzzleAnswerRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The new puzzle status",
                schema: PuzzleSchema,
            },
            [StatusCode.ClientErrorNotFound]: [
                {
                    id: PuzzleNotCreatedError.error,
                    description: "The user's puzzle hasn't been created yet",
                    schema: PuzzleNotCreatedErrorSchema,
                },
                {
                    id: PuzzleQuestionNotFoundError.error,
                    description: "The question requested doesn't exist",
                    schema: PuzzleQuestionNotFoundErrorSchema,
                },
            ],
            [StatusCode.ClientErrorBadRequest]: {
                description: "The answer was incorrect",
                schema: PuzzleIncorrectAnswerErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);

        const qidString = req.params.qid;
        const { answer } = req.body;

        // Invalid question
        let qid;
        try {
            qid = parseInt(qidString, 10);
        } catch {
            return res.status(StatusCode.ClientErrorNotFound).send(PuzzleQuestionNotFoundError);
        }

        if (qid < 0 || qid >= Config.PUZZLE.length) {
            return res.status(StatusCode.ClientErrorNotFound).send(PuzzleQuestionNotFoundError);
        }

        const puzzle = await Models.PuzzleItem.findOne({ userId });

        // Not yet created
        if (!puzzle) {
            return res.status(StatusCode.ClientErrorNotFound).send(PuzzleNotCreatedError);
        }

        // Already completed, good to go
        if (puzzle.problemComplete[qid]) {
            return res.status(StatusCode.SuccessOK).send(puzzle);
        }

        // Incorrect
        if (answer !== Config.PUZZLE[qid]) {
            return res.status(StatusCode.ClientErrorBadRequest).send(PuzzleIncorrectAnswerError);
        }

        // Otherwise, correct
        const updatedPuzzleItem = await Models.PuzzleItem.findOneAndUpdate(
            { userId },
            {
                $set: {
                    lastCorrect: Math.floor(Date.now() / Config.MILLISECONDS_PER_SECOND),
                    [`problemComplete.${qid}`]: true,
                },
                $inc: {
                    score: 1,
                },
            },
            { new: true },
        );

        if (!updatedPuzzleItem) {
            throw Error("Failed to update existing puzzle");
        }

        return res.status(StatusCode.SuccessOK).send(updatedPuzzleItem);
    },
);

puzzleRouter.post(
    "/create",
    specification({
        method: "post",
        path: "/puzzle/create/",
        tag: Tag.PUZZLE,
        role: Role.USER,
        summary: "Create the currently authenticated user's puzzle",
        body: PuzzleCreateRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The newly created puzzle status",
                schema: PuzzleSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);
        const { teamName } = req.body;

        // Create a new PuzzleItem model
        const newPuzzleItem = new PuzzleItem(userId, teamName, Config.PUZZLE_EVENT_END_TIME, 0, [
            false,
            false,
            false,
            false,
            false,
            false,
            false,
            false,
            false,
            false,
        ]);

        await Models.PuzzleItem.findOneAndUpdate({ userId }, newPuzzleItem, { upsert: true, new: true });

        return res.status(StatusCode.SuccessOK).send(newPuzzleItem);
    },
);

export default puzzleRouter;
