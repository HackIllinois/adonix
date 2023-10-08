/*
various import functions up here
*/
import express, { Request, Response, Router } from "express";
import Constants from "../../constants.js";
import { JwtPayload } from "../auth/auth-models.js";
//import { DecisionInfoModel, DecisionEntryModel } from "../../database/decision-db.js";
import {
    hasElevatedPerms,
} from "../auth/auth-lib.js";
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

    if(!queryResult) {
        return res.status(Constants.BAD_REQUEST).send({ error: "Unknown Error" });
    }

    const rsvpDecision : boolean = queryResult.status === "ACCEPTED" && queryResult.response === "ACCEPTED";
    return res.status(Constants.SUCCESS).send({ "id" : userid, isAttending: rsvpDecision });
});

/**
 * @api {get} /rsvp/ GET /rsvp/
 * @apiGroup rsvp
 * @apiDescription Check RSVP decision for current user
 * 
 * @apiSuccess (200: Success) { boolean } whether they are/aren't attending
 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
 *      "isAttending": true
 * 	}
 *
 * @apiUse strongVerifyErrors
 */
 rsvpRouter.get("/", async (req: Request, res: Response) => {

    const userid: string | undefined = req.params.USERID;
    
    const queryResult: DecisionInfo | null = await DecisionInfoModel.findOne({ userId: userid });

    if(!queryResult) {
        return res.status(Constants.BAD_REQUEST).send({ error: "Unknown Error" });
    }

    const rsvpDecision : boolean = queryResult.status === "ACCEPTED" && queryResult.response === "ACCEPTED";
    return res.status(Constants.SUCCESS).send({ isAttending: rsvpDecision });
});

/**
 * @api {post} /rsvp/ POST /rsvp/
 * @apiGroup rsvp
 * @apiDescription Creates an rsvp for the currently authenticated user (determined by the JWT in the Authorization header).
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
    rsvpRouter.post("/", async (req: Request, res: Response) => {
        //example request:
        /*
        {
            "isAttending": true
        }
        */

        const userid: string | undefined = req.params.USERID;
        
        const queryResult: DecisionInfo | null = await DecisionInfoModel.findOne({ userId: userid });
    
        if(!queryResult) {
            return res.status(Constants.BAD_REQUEST).send({ error: "Unknown Error" });
        }
    
        const rsvpDecision : boolean = queryResult.status === "ACCEPTED" && queryResult.response === "ACCEPTED";
        return res.status(Constants.SUCCESS).send({ isAttending: rsvpDecision });
    });





export default rsvpRouter;