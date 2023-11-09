import { Router, Request, Response } from "express";
import { strongJwtVerification } from "../../middleware/verify-jwt.js";

import { JwtPayload } from "../auth/auth-models.js";
import { DecisionStatus, DecisionResponse, AdmissionDecision } from "../../database/admission-db.js";
import Models from "../../database/models.js";
import { hasElevatedPerms } from "../auth/auth-lib.js";
import { ApplicantDecisionFormat } from "./admission-formats.js";
import { StatusCode } from "status-code-enum";
import { NextFunction } from "express-serve-static-core";
import { RouterError } from "../../middleware/error-handler.js";

const admissionRouter: Router = Router();

/**
 * @api {get} /admission/not-sent/ GET /admission/not-sent/
 * @apiGroup Admission
 * @apiDescription Gets all applicants' decisions who don't have an email sent
 *
 * @apiSuccess (200: Success) {Json} entries The list of applicants' decisions without email sent
 * @apiSuccessExample Example Success Response (Staff POV)
 * HTTP/1.1 200 OK
 * [
 *         {
 *             "userId": "user1",
 *             "status": "ACCEPTED",
 *             "response": "ACCEPTED",
 *             "reviewer": "reviewer1",
 *             "emailSent": false
 *         },
 *         {
 *             "userId": "user3",
 *             "status": "WAITLISTED",
 *             "response": "PENDING",
 *             "reviewer": "reviewer1",
 *             "emailSent": false
 *         },
 *         {
 *             "userId": "user4",
 *             "status": "WAITLISTED",
 *             "response": "PENDING",
 *             "reviewer": "reviewer1",
 *             "emailSent": false
 *         }
 * ]
 * @apiUse strongVerifyErrors
 * @apiError (500: Internal Server Error) {String} InternalError occurred on the server.
 * @apiError (403: Forbidden) {String} Forbidden API accessed by user without valid perms.
 * */
admissionRouter.get("/not-sent/", strongJwtVerification, async (_: Request, res: Response, next: NextFunction) => {
    const token: JwtPayload = res.locals.payload as JwtPayload;
    if (!hasElevatedPerms(token)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "Forbidden"));
    }
    try {
        const filteredEntries: AdmissionDecision[] = await Models.AdmissionDecision.find({ emailSent: false });
        return res.status(StatusCode.SuccessOK).send(filteredEntries);
    } catch (error) {
        return next(new RouterError(undefined, undefined, undefined, error));
    }
});

/**
 * @api {put} /admission/ PUT /admission/
 * @apiGroup Admission
 * @apiDescription Updates the admission decision status of all applicants
 *
 * @apiHeader {String} Authorization Admin or Staff JWT Token
 *
 * @apiBody {Json} entries List of Applicants whose status needs to be updated
 *
 * @apiParamExample Example Request (Staff):
 * HTTP/1.1 PUT /admission/
 * [
 *     {
 *       "userId": "user1",
 *       "status": "ACCEPTED"
 *     },
 *     {
 *       "userId": "user2",
 *       "status": "REJECTED"
 *     },
 *     {
 *       "userId": "user3",
 *       "status": "WAITLISTED"
 *     }
 * ]
 *
 * @apiSuccess (200: Success) {String} StatusSuccess
 *
 * @apiUse strongVerifyErrors
 * @apiError (500: Internal Server Error) {String} InternalError occurred on the server.
 * @apiError (403: Forbidden) {String} Forbidden API accessed by user without valid perms.
 * */
admissionRouter.put("/", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const token: JwtPayload = res.locals.payload as JwtPayload;
    if (!hasElevatedPerms(token)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "Forbidden"));
    }
    const updateEntries: ApplicantDecisionFormat[] = req.body as ApplicantDecisionFormat[];
    const ops = updateEntries.map((entry) => {
        return Models.AdmissionDecision.findOneAndUpdate({ userId: entry.userId }, { $set: { status: entry.status } });
    });
    try {
        await Promise.all(ops);
        return res.status(StatusCode.SuccessOK).send({ message: "StatusSuccess" });
    } catch (error) {
        return next(new RouterError(undefined, undefined, undefined, error));
    }
});

/**
 * @api {get} /admission/rsvp/:USERID/ GET /admission/rsvp/:USERID/
 * @apiGroup Admission
 * @apiDescription Check RSVP decision for a given userId, provided that the authenticated user has elevated perms
 *
 * @apiParam {String} USERID Id to pull the decision for
 *
 * @apiSuccess (200: Success) {string} userId
 * @apiSuccess (200: Success) {string} User's application status
 * @apiSuccess (200: Success) {string} User's Response (whether or whether not they're attending)
 * @apiSuccess (200: Success) {string} Reviewer
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
admissionRouter.get("/rsvp/:USERID", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const userId: string | undefined = req.params.USERID;

    const payload: JwtPayload = res.locals.payload as JwtPayload;

    //Sends error if caller doesn't have elevated perms
    if (!hasElevatedPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "Forbidden"));
    }

    const queryResult: AdmissionDecision | null = await Models.AdmissionDecision.findOne({ userId: userId });

    //Returns error if query is empty
    if (!queryResult) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "UserNotFound"));
    }

    return res.status(StatusCode.SuccessOK).send(queryResult);
});

/**
 * @api {get} /admission/rsvp/ GET /admission/rsvp/
 * @apiGroup Admission
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
admissionRouter.get("/rsvp", strongJwtVerification, async (_: Request, res: Response, next: NextFunction) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    const userId: string = payload.id;

    const queryResult: AdmissionDecision | null = await Models.AdmissionDecision.findOne({ userId: userId });

    //Returns error if query is empty
    if (!queryResult) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "UserNotFound"));
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
 * @api {put} /admission/rsvp/ PUT /admission/rsvp/
 * @apiGroup Admission
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
admissionRouter.put("/rsvp/", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const rsvp: boolean | undefined = req.body.isAttending;

    //Returns error if request body has no isAttending parameter
    if (rsvp === undefined) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "InvalidParams"));
    }

    const payload: JwtPayload = res.locals.payload as JwtPayload;

    const userid: string = payload.id;

    const queryResult: AdmissionDecision | null = await Models.AdmissionDecision.findOne({ userId: userid });

    //Returns error if query is empty
    if (!queryResult) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "UserNotFound"));
    }

    //If the current user has not been accepted, send an error
    if (queryResult.status != DecisionStatus.ACCEPTED) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "NotAccepted"));
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
        return next(new RouterError());
    }
});

export default admissionRouter;
