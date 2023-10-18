import { Request, Response, Router } from "express";
import Constants from "../../constants.js";
import { strongJwtVerification } from "../../middleware/verify-jwt.js";
import { JwtPayload } from "../auth/auth-models.js";
import { hasElevatedPerms } from "../auth/auth-lib.js";
import { DecisionStatus, DecisionResponse, DecisionInfo } from "../../database/decision-db.js";
import Models from "../../database/models.js";

const rsvpRouter: Router = Router();

rsvpRouter.get("/test/", (_: Request, res: Response) => {
    res.end("RSVP endpoint is working!");
});

/**
 * @api {get} /rsvp/:USERID/ GET /rsvp/:USERID/
 * @apiGroup rsvp
 * @apiDescription Check RSVP decision for a given userId, provided that the current user has elevated perms
 *
 * @apiSuccess (200: Success) {string} userId
 * @apiSuccess (200: Success) {boolean} whether they are/aren't attending
 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
 *		"userId": "github0000001",
 *      "isAttending": true
 * 	}
 *
 * @apiUse strongVerifyErrors
 */
rsvpRouter.get("/:USERID", strongJwtVerification, async (req: Request, res: Response) => {
    const userId: string | undefined = req.params.USERID;

    //Returns error if userid parameter is empty
    if (!userId) {
        return res.status(Constants.BAD_REQUEST).send({ error: "InvalidParams" });
    }

    const payload: JwtPayload = res.locals.payload as JwtPayload;
    //Returns error if caller doesn't have elevated perms
    if (!hasElevatedPerms(payload)) {
        return res.redirect("/");
    }

    const queryResult: DecisionInfo | null = await Models.DecisionInfo.findOne({ userId: userId });

    //Returns error if query is empty
    if (!queryResult) {
        return res.status(Constants.BAD_REQUEST).send({ error: "UserNotFound" });
    }

    const rsvpDecision: boolean =
        queryResult.status === DecisionStatus.ACCEPTED && queryResult.response === DecisionResponse.ACCEPTED;
    return res.status(Constants.SUCCESS).send({ userId: userId, isAttending: rsvpDecision });
});

/**
 * @api {get} /rsvp/ GET /rsvp/
 * @apiGroup rsvp
 * @apiDescription Check RSVP decision for current user
 *
 * @apiSuccess (200: Success) {string} userId
 * @apiSuccess (200: Success) {boolean} whether they are/aren't attending
 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
 *      "isAttending": true
 * 	}
 *
 * @apiUse strongVerifyErrors
 */
rsvpRouter.get("/", strongJwtVerification, async (_: Request, res: Response) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    const userId: string = payload.id;

    const queryResult: DecisionInfo | null = await Models.DecisionInfo.findOne({ userId: userId });

    //Returns error if query is empty
    if (!queryResult) {
        return res.status(Constants.BAD_REQUEST).send({ error: "User not found!" });
    }

    const rsvpDecision: boolean =
        queryResult.status === DecisionStatus.ACCEPTED && queryResult.response === DecisionResponse.ACCEPTED;
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
 * @apiSuccess (200: Success) {string} MongoDB object ID
 * @apiSuccess (200: Success) {string} userId
 * @apiSuccess (200: Success) {string} User's applicatoin status
 * @apiSuccess (200: Success) {string} User's Response
 * @apiSuccess (200: Success) {string} Reviwer
 * @apiSuccess (200: Success) {boolean} Whether email has been sent
 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
 *      "_id": "652c311b6e283244d2ef4c29",
 *      "userId": "github0000001",
 *      "status": "ACCEPTED",
 *      "response": "ACCEPTED",
 *      "reviewer": "reviewer1",
 *      "emailSent": true
 * 	}
 *
 * @apiUse strongVerifyErrors
 */
rsvpRouter.put("/", strongJwtVerification, async (req: Request, res: Response) => {
    const rsvp: boolean | undefined = req.body.isAttending;

    //Returns error if request body has no isAttending parameter
    if (rsvp === undefined) {
        return res.status(Constants.BAD_REQUEST).send({ error: "InvalidParams" });
    }

    const payload: JwtPayload = res.locals.payload as JwtPayload;

    const userid: string = payload.id;

    const queryResult: DecisionInfo | null = await Models.DecisionInfo.findOne({ userId: userid });

    //Returns error if query is empty
    if (!queryResult) {
        return res.status(Constants.BAD_REQUEST).send({ error: "UnknownError" });
    }

    //If the current user has not been accepted, send an error
    if (queryResult.status != DecisionStatus.ACCEPTED) {
        return res.status(Constants.FORBIDDEN).send({ error: "Forbidden" });
    }

    //If current user has been accepted, update their RSVP decision to "ACCEPTED"/"DECLINED" acoordingly
    const updatedDecision: DecisionInfo | null = await Models.DecisionInfo.findOneAndUpdate(
        { userId: queryResult.userId },
        {
            status: queryResult.status,
            response: rsvp ? DecisionResponse.ACCEPTED : DecisionResponse.DECLINED,
        },
        { new: true },
    );

    if (updatedDecision) {
        return res.status(Constants.SUCCESS).send(updatedDecision);
    } else {
        return res.status(Constants.INTERNAL_ERROR).send({ error: "InternalError" });
    }
});

export default rsvpRouter;
