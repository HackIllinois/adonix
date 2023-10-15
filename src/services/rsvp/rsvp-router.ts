import express, { Request, Response, Router } from "express";
import Constants from "../../constants.js";
import { JwtPayload } from "../auth/auth-models.js";
import { hasElevatedPerms } from "../auth/auth-lib.js";
import { DecisionInfo, DecisionInfoModel } from "../../database/decision-db.js";

const rsvpRouter: Router = Router();
rsvpRouter.use(express.urlencoded({ extended: false }));

rsvpRouter.get("/test/", (_: Request, res: Response) => {
    res.end("Auth endpoint is working!");
});

/**
 * @api {get} /rsvp/USERID/ GET /rsvp/USERID/
 * @apiGroup rsvp
 * @apiDescription Check RSVP decision for a given USERID, provided that the current user has elevated perms
 *
 * @apiSuccess (200: Success) { string, boolean } usedId and whether they are/aren't attending
 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
 *		"id": "github0000001",
 *      "isAttending": true
 * 	}
 *
 * @apiUse strongVerifyErrors
 */
rsvpRouter.get("/:USERID/", async (req: Request, res: Response) => {
    const userid: string | undefined = req.params.USERID;

    //Returns error if userid parameter is empty
    if (!userid) {
        return res.status(Constants.BAD_REQUEST).send({ error: "InvalidParams" });
    }

    const token: JwtPayload = res.locals.payload as JwtPayload;

    //Returns error if caller doesn't have elevated perms
    if (!hasElevatedPerms(token)) {
        return res.status(Constants.FORBIDDEN).send({ error: "InvalidToken" });
    }

    const queryResult: DecisionInfo | null = await DecisionInfoModel.findOne({ userId: userid });

    //Returns error if query is empty
    if (!queryResult) {
        return res.status(Constants.BAD_REQUEST).send({ error: "Unknown Error" });
    }

    const rsvpDecision: boolean = queryResult.status === "ACCEPTED" && queryResult.response === "ACCEPTED";
    return res.status(Constants.SUCCESS).send({ id: userid, isAttending: rsvpDecision });
});

/**
 * @api {get} /rsvp/ GET /rsvp/
 * @apiGroup rsvp
 * @apiDescription Check RSVP decision for current user
 *
 * @apiSuccess (200: Success) { string, boolean } usedid and whether they are/aren't attending
 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
 *		"id": "github0000001",
 *      "isAttending": true
 * 	}
 *
 * @apiUse strongVerifyErrors
 */
rsvpRouter.get("/", async (_: Request, res: Response) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    const userid: string | undefined = payload.id;

    //Returns error if payload has no userid parameter
    if (!userid) {
        return res.status(Constants.BAD_REQUEST).send({ error: "InvalidParams" });
    }

    const queryResult: DecisionInfo | null = await DecisionInfoModel.findOne({ userId: userid });

    //Returns error if query is empty
    if (!queryResult) {
        return res.status(Constants.BAD_REQUEST).send({ error: "Unknown Error" });
    }

    const rsvpDecision: boolean = queryResult.status === "ACCEPTED" && queryResult.response === "ACCEPTED";
    return res.status(Constants.SUCCESS).send({ isAttending: rsvpDecision });
});

/**
 * @api {put} /rsvp/ Put /rsvp/
 * @apiGroup rsvp
 * @apiDescription Updates an rsvp for the currently authenticated user (determined by the JWT in the Authorization header).
 *
 * @apiBody {boolean} isAttending Whether or whether not the currently authenticated user is attending
 * @apiParamExample {json} Example Request:
 * {
 *      "isAttending": true
 * }
 *
 * @apiSuccess (200: Success) { string, boolean } usedId and whether they are/aren't attending
 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
 *		"id": "github0000001",
 *      "isAttending": true
 * 	}
 *
 * @apiUse strongVerifyErrors
 */
rsvpRouter.put("/", async (req: Request, res: Response) => {
    const rsvp: boolean | undefined = req.body.isAttending;

    //Returns error if request body has no isAttending parameter
    if (rsvp === undefined) {
        return res.status(Constants.BAD_REQUEST).send({ error: "InvalidParams" });
    }

    const payload: JwtPayload = res.locals.payload as JwtPayload;

    const userid: string | undefined = payload.id;

    //Returns error if payload has no userid parameter
    if (!userid) {
        return res.status(Constants.BAD_REQUEST).send({ error: "InvalidParams" });
    }

    const queryResult: DecisionInfo | null = await DecisionInfoModel.findOne({ userId: userid });

    //Returns error if query is empty
    if (!queryResult) {
        return res.status(Constants.BAD_REQUEST).send({ error: "Unknown Error" });
    }

    //If the current user has not been accepted, send an error
    if (queryResult.status != "ACCEPTED") {
        return res.status(Constants.BAD_REQUEST).send({ error: "User has not been accepted to the hackathon" });
    }

    //If current user has been accepted, update their RSVP decision to "ACCEPTED"/"DECLINED" acoordingly
    const updatedDecision: DecisionInfo | null = await DecisionInfoModel.findOneAndUpdate(
        { userId: queryResult.userId },
        {
            status: queryResult.status,
            response: rsvp ? "ACCEPTED" : "DECLINED",
        },
    );

    if (updatedDecision) {
        return res.status(Constants.SUCCESS).send({ id: userid, isAttending: rsvp });
    } else {
        return res.status(Constants.INTERNAL_ERROR).send({ error: "InternalError" });
    }
});

export default rsvpRouter;
