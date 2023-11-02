import { Router, Request, Response } from "express";
import { strongJwtVerification } from "../../middleware/verify-jwt.js";

import { JwtPayload } from "../auth/auth-models.js";
import { AdmissionDecision } from "../../database/admission-db.js";
import Models from "../../database/models.js";
import { hasElevatedPerms } from "../auth/auth-lib.js";
import { ApplicantDecisionFormat } from "./admission-formats.js";
import { StatusCode } from "status-code-enum";

const admissionRouter: Router = Router();

/**
 * @api {get} /admission/ GET /admission/
 * @apiGroup Admission
 * @apiDescription Gets all applicants who don't have an email sent
 *
 * @apiSuccess (200: Success) {Json} entries The list of applicants without email sent
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
 * @apiUser strongVerifyErrors
 * @apiError (500: Internal Server Error) {String} InternalError occurred on the server.
 * @apiError (403: Forbidden) {String} Forbidden API accessed by user without valid perms.
 * */
admissionRouter.get("/", strongJwtVerification, async (_: Request, res: Response) => {
    const token: JwtPayload = res.locals.payload as JwtPayload;
    if (!hasElevatedPerms(token)) {
        return res.status(StatusCode.ClientErrorForbidden).send({ error: "Forbidden" });
    }
    try {
        const filteredEntries: AdmissionDecision[] = await Models.AdmissionDecision.find({ emailSent: false });
        return res.status(StatusCode.SuccessOK).send(filteredEntries);
    } catch (error) {
        console.error(error);
    }
    return res.status(StatusCode.ClientErrorBadRequest).send({ error: "InternalError" });
});
/**
 * @api {put} /admission/ PUT /admission/
 * @apiGroup Admission
 * @apiDescription Updates the admission status of all applicants
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
admissionRouter.put("/", strongJwtVerification, async (req: Request, res: Response) => {
    const token: JwtPayload = res.locals.payload as JwtPayload;
    if (!hasElevatedPerms(token)) {
        return res.status(StatusCode.ClientErrorForbidden).send({ error: "Forbidden" });
    }
    const updateEntries: ApplicantDecisionFormat[] = req.body as ApplicantDecisionFormat[];
    const ops = updateEntries.map((entry) => {
        return Models.AdmissionDecision.findOneAndUpdate({ userId: entry.userId }, { $set: { status: entry.status } });
    });
    try {
        await Promise.all(ops);
        return res.status(StatusCode.SuccessOK).send({ message: "StatusSuccess" });
    } catch (error) {
        console.log(error);
    }
    return res.status(StatusCode.ClientErrorBadRequest).send("InternalError");
});
export default admissionRouter;
