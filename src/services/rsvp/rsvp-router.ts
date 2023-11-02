import { Request, Response, Router } from "express";
import { StatusCode } from "status-code-enum";
import { strongJwtVerification } from "../../middleware/verify-jwt.js";
import { JwtPayload } from "../auth/auth-models.js";
import { hasElevatedPerms } from "../auth/auth-lib.js";
import { DecisionStatus, DecisionResponse, AdmissionDecision } from "../../database/admission-db.js";
import Models from "../../database/models.js";

const rsvpRouter: Router = Router();

/**
 * @api {get} /rsvp/:USERID/ GET /rsvp/:USERID/
 * @apiGroup rsvp
 * @apiDescription Check RSVP decision for a given userId, provided that the current user has elevated perms
 *
 *
 * @apiSuccess (200: Success) {string} userId
 * @apiSuccess (200: Success) {string} User's applicatoin status
 * @apiSuccess (200: Success) {string} User's Response (whether or whether not they're attending)
 * @apiSuccess (200: Success) {string} Reviwer
 * @apiSuccess (200: Success) {boolean} Whether email has been sent
 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
 *      "userId": "github0000001",
 *      "status": "ACCEPTED",
 *      "response": "PENDING",
 *      "reviewer": "reviewer1",
 *      "emailSent": true
 * 	}
 *
 * @apiUse strongVerifyErrors
 */
rsvpRouter.get("/:USERID", strongJwtVerification, async (req: Request, res: Response) => {
    const userId: string | undefined = req.params.USERID;

    const payload: JwtPayload = res.locals.payload as JwtPayload;

    //Sends error if caller doesn't have elevated perms
    if (!hasElevatedPerms(payload)) {
        return res.status(StatusCode.ClientErrorForbidden).send({ error: "Forbidden" });
    }

    const queryResult: AdmissionDecision | null = await Models.AdmissionDecision.findOne({ userId: userId });

    //Returns error if query is empty
    if (!queryResult) {
        return res.status(StatusCode.ClientErrorBadRequest).send({ error: "UserNotFound" });
    }

    return res.status(StatusCode.SuccessOK).send(queryResult);
});

/**
 * @api {get} /rsvp/ GET /rsvp/
 * @apiGroup rsvp
 * @apiDescription Check RSVP decision for current user, returns filtered info for attendees and unfiltered info for staff/admin
 *
 *
 * @apiSuccess (200: Success) {string} userId
 * @apiSuccess (200: Success) {string} User's applicatoin status
 * @apiSuccess (200: Success) {string} User's Response (whether or whether not they're attending)
 * @apiSuccessExample Example Success Response (caller is a user):
 * 	HTTP/1.1 200 OK
 *	{
 *      "userId": "github0000001",
 *      "status": "ACCEPTED",
 *      "response": "ACCEPTED",
 * 	}
 *
 *  @apiSuccessExample Example Success Response (caller is a staff/admin):
 * 	HTTP/1.1 200 OK
 *	{
 *      "userId": "github0000001",
 *      "status": "ACCEPTED",
 *      "response": "ACCEPTED",
 *      "reviewer": "reviewer1",
 *      "emailSent": true,
 * 	}
 *
 * @apiUse strongVerifyErrors
 */
rsvpRouter.get("/", strongJwtVerification, async (_: Request, res: Response) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    const userId: string = payload.id;

    const queryResult: AdmissionDecision | null = await Models.AdmissionDecision.findOne({ userId: userId });

    //Returns error if query is empty
    if (!queryResult) {
        return res.status(StatusCode.ClientErrorBadRequest).send({ error: "UserNotFound" });
    }

    //Filters data if caller doesn't have elevated perms
    if (!hasElevatedPerms(payload)) {
        return res
            .status(StatusCode.SuccessOK)
            .send({ userId: queryResult.userId, status: queryResult.status, response: queryResult.response });
    }

    return res.status(StatusCode.SuccessOK).send(queryResult);
});

/**
 * @api {put} /rsvp/ Put /rsvp/
 * @apiGroup rsvp
 * @apiDescription Updates an rsvp for the currently authenticated user (determined by the JWT in the Authorization header).
 *
 * @apiBody {boolean} isAttending Whether or whether not the currently authenticated user is attending
 * @apiParamExample {json} Example Request:
 * {
 *      "isAttending": false
 * }
 *
 * @apiSuccess (200: Success) {string} userId
 * @apiSuccess (200: Success) {string} User's applicatoin status
 * @apiSuccess (200: Success) {string} User's Response (whether or whether not they're attending)
 * @apiSuccess (200: Success) {string} Reviwer
 * @apiSuccess (200: Success) {boolean} Whether email has been sent
 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
 *      "userId": "github0000001",
 *      "status": "ACCEPTED",
 *      "response": "DECLINED",
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
        return res.status(StatusCode.ClientErrorBadRequest).send({ error: "InvalidParams" });
    }

    const payload: JwtPayload = res.locals.payload as JwtPayload;

    const userid: string = payload.id;

    const queryResult: AdmissionDecision | null = await Models.AdmissionDecision.findOne({ userId: userid });

    //Returns error if query is empty
    if (!queryResult) {
        return res.status(StatusCode.ClientErrorBadRequest).send({ error: "UserNotFound" });
    }

    //If the current user has not been accepted, send an error
    if (queryResult.status != DecisionStatus.ACCEPTED) {
        return res.status(StatusCode.ClientErrorForbidden).send({ error: "NotAccepted" });
    }

    //If current user has been accepted, update their RSVP decision to "ACCEPTED"/"DECLINED" acoordingly
    const updatedDecision: AdmissionDecision | null = await Models.AdmissionDecision.findOneAndUpdate(
        { userId: queryResult.userId },
        {
            status: queryResult.status,
            response: rsvp ? DecisionResponse.ACCEPTED : DecisionResponse.DECLINED,
        },
        { new: true },
    );

    if (updatedDecision) {
        //return res.status(StatusCode.SuccessOK).send(updatedDecision.toObject());
        return res.status(StatusCode.SuccessOK).send(updatedDecision);
    } else {
        return res.status(StatusCode.ServerErrorInternal).send({ error: "InternalError" });
    }
});

export default rsvpRouter;
