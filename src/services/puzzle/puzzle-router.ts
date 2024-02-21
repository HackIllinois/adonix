import { Request, Response, Router } from "express";
import { NextFunction } from "express-serve-static-core";
import { StatusCode } from "status-code-enum";
import Models from "../../database/models.js";
import { RouterError } from "../../middleware/error-handler.js";
import { strongJwtVerification, weakJwtVerification } from "../../middleware/verify-jwt.js";
import { JwtPayload } from "../auth/auth-models.js";
import { PuzzleItem } from "../../database/puzzle-db.js";
import Config from "../../config.js";
import { updatePuzzle } from "./puzzle-lib.js";
import { isString } from "../../formatTools.js";

const puzzleRouter: Router = Router();

/**
 * @api {get} /puzzle/status GET /status
 * @apiGroup Puzzle
 * @apiDescription Get status on current user's puzzle.
 *
 * @apiHeader {String} Authorization User's JWT Token with admin permissions.
 *
 * @apiSuccess (200: Success) {String} userId Player's userId.
 * @apiSuccess (200: Success) {String} teamName Player's chosen team name.
 * @apiSuccess (200: Success) {Number} lastCorrect Timestamp in epoch of last correct submission.
 * @apiSuccess (200: Success) {Array} problemComplete Boolean array representing which problems were complete.
 * @apiSuccessExample Example Success Response
 * HTTP/1.1 200 OK
 * {
 *   userId: "user1234",
 *   teamName: "team1234",
 *   lastCorrect: 19828219231,
 *   problemComplete: [
 *      true,
 *      false,
 *      true,
 *      false,
 *      true,
 *      true
 *   ]
 * }
 *
 * @apiUse strongVerifyErrors
 * @apiError (404: User Not Found) {String} UserNotFound User does not exist.
 **/
puzzleRouter.get("/status", strongJwtVerification, async (_: Request, res: Response, next: NextFunction) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;
    const targetUser: string = payload.id;

    const puzzle: PuzzleItem | null = await Models.PuzzleItem.findOne({ userId: targetUser });

    if (!puzzle) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "UserNotFound"));
    }

    return res.status(StatusCode.SuccessOK).send(puzzle);
});

/**
 * @api {post} /puzzle/submit/:QID POST /puzzle/submit/:QID
 * @apiGroup Puzzle
 * @apiDescription Submit answer to puzzle based on question number (0-indexed).
 *
 * @apiHeader {String} Authorization User's JWT Token with admin permissions.
 *
 * @apiBody {json} answer The user's submitted answer.
 * @apiParamExample {Json} Request Body Example for an Item:
 * {
 *      "answer": "abcd"
 * }
 *
 * @apiSuccess (200: Success) {Json} updated items.
 * @apiSuccessExample Example Success Response
 * HTTP/1.1 200 OK
 * {
 *   userId: "user1234",
 *   teamName: "team1234",
 *   lastCorrect: 19828219231,
 *   problemComplete: [
 *      true,
 *      false,
 *      true,
 *      false,
 *      true,
 *      true
 *   ]
 * }
 *
 * @apiUse strongVerifyErrors
 * @apiError (400: Bad Request) {String} BadRequest Incorrectly formatted input.
 * @apiError (404: User Not Found) {String} UserNotFound User does not exist.
 * @apiError (406: Not Acceptable) {String} IncorrectAnswer Solution was right but incorrectly formatted.
 * @apiError (500: Internal Server Error) {String} InternalError An error occurred on the server.
 * */
puzzleRouter.post("/submit/:QID", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;
    const targetUser: string = payload.id;

    if (!req.params.QID || !isString(req.params.QID)) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "Bad Request"));
    }

    const qid: number = parseInt(req.params.QID);
    const answer: string = req.body.answer as string;

    // already completed this question
    const puzzle: PuzzleItem | null = await Models.PuzzleItem.findOne({ userId: targetUser });

    if (!puzzle) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "UserNotFound"));
    }

    if (puzzle.problemComplete[qid]) {
        return res.status(StatusCode.SuccessOK).send(puzzle);
    }

    // incorrect answer
    if (answer !== Config.PUZZLE[qid]) {
        return next(new RouterError(StatusCode.ClientErrorNotAcceptable, "IncorrectAnswer"));
    }

    try {
        const updatedPuzzleItem = await updatePuzzle(targetUser, qid);
        return res.status(StatusCode.SuccessOK).send(updatedPuzzleItem);
    } catch (error) {
        return next(new RouterError(StatusCode.ServerErrorInternal, "InternalError"));
    }
});

/**
 * @api {post} /puzzle/create POST /puzzle/create
 * @apiGroup Puzzle
 * @apiDescription Create a puzzle item for user.
 *
 * @apiHeader {String} Authorization User's JWT Token with admin permissions.
 *
 * @apiBody {json} teamName The user's requested team name.
 * @apiParamExample {Json} Request Body Example for a teamName:
 * {
 *      "teamName": "myTeam"
 * }
 *
 * @apiSuccess (200: Success) {Json} Success!.
 *
 * @apiError (404: User Not Found) {String} UserNotFound User does not exist.
 * */
puzzleRouter.post("/create", strongJwtVerification, async (req: Request, res: Response, _: NextFunction) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;
    const targetUser: string = payload.id;
    const teamName: string = req.body.teamName;

    // no need to check that user exists, handled by strongJwtVerification

    try {
        // Create a new PuzzleItem model
        const newPuzzleItem = new Models.PuzzleItem({
            userId: targetUser,
            teamName: teamName,
            lastCorrect: Config.PUZZLE_EVENT_END_TIME,
            problemComplete: [false, false, false, false, false, false, false, false, false, false],
            score: 0,
        });

        await Models.PuzzleItem.findOneAndUpdate({ userId: targetUser }, newPuzzleItem, { upsert: true, new: true });

        return res.status(StatusCode.SuccessOK).send({ newPuzzleItem });
    } catch (error) {
        return res.status(StatusCode.ServerErrorInternal).send({ status: false, error: "Internal Server Error" });
    }
});

/**
 * @api {get} /puzzle/ranking GET /puzzle/ranking
 * @apiGroup Puzzle
 * @apiDescription Get the current ranking of participants in puzzle.
 *
 * @apiSuccess (200: Success) {Array} ranking List of all teamnames ranked.
 * @apiSuccess (200: Success) {String} qrInfo Array of stringified QR codes for the requested item 

 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	[
 *      "team1",
 *      "team2",
 *      "team3",
 *      "team4",
 *      "team5"
 *  ]
 *
 * @apiUse weakVerifyErrors
 */
puzzleRouter.get("/ranking", weakJwtVerification, async (_1: Request, res: Response, _2: NextFunction) => {
    const teamsRanked: PuzzleItem[] = await Models.PuzzleItem.find();

    const sortedPuzzleItems = teamsRanked.sort((a, b) => {
        if (a.score !== b.score) {
            return b.score - a.score;
        } else {
            return a.lastCorrect - b.lastCorrect;
        }
    });

    const sortedTeams: string[] = sortedPuzzleItems.map((p) => p.teamName);

    return res.status(StatusCode.SuccessOK).send({ sortedTeams });
});

export default puzzleRouter;
