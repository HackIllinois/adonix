import { Router } from "express";
import { strongJwtVerification } from "../../middleware/verify-jwt.js";

import { DecisionStatus, DecisionResponse, AdmissionDecision } from "../../database/admission-db.js";
import Models from "../../database/models.js";
import { hasElevatedPerms } from "../auth/auth-lib.js";
import { isValidApplicantFormat } from "./admission-formats.js";
import { StatusCode } from "status-code-enum";
import { RouterError } from "../../middleware/error-handler.js";
import { performRSVP } from "./admission-lib.js";
import { MailInfoFormat } from "../mail/mail-formats.js";
import { RegistrationTemplates } from "../../config.js";
import { getApplication } from "../registration/registration-lib.js";
import { sendMail } from "../mail/mail-lib.js";

const admissionRouter: Router = Router();

/**
 * @api {get} /admission/notsent/ GET /admission/notsent/
 * @apiGroup Admission
 * @apiDescription Gets applicants' decisions who don't have an email sent
 *
 * @apiSuccess (200: Success) {Json} entries The list of applicants' decisions without email sent
 * @apiSuccessExample Example Success Response (Staff POV)
 * HTTP/1.1 200 OK
 * [
 *         {
 *             "userId": "user1",
 *             "status": "ACCEPTED",
 *             "response": "ACCEPTED",
 *             "emailSent": false,
 *              "reimbursementValue": 100,
 *         },
 *         {
 *             "userId": "user3",
 *             "status": "WAITLISTED",
 *             "response": "PENDING",
 *             "emailSent": false,
 *              "reimbursementValue": 100,
 *         },
 *         {
 *             "userId": "user4",
 *             "status": "WAITLISTED",
 *             "response": "PENDING",
 *             "emailSent": false,
 *              "reimbursementValue": 100,
 *         }
 * ]
 * @apiUse strongVerifyErrors
 * @apiError (403: Forbidden) {String} Forbidden API accessed by user without valid perms.
 * @apiError (500: Internal Server Error) {String} InternalError occurred on the server.
 * */
admissionRouter.get("/notsent/", strongJwtVerification(), async (_, res, next) => {
    const token = res.locals.payload;
    if (!hasElevatedPerms(token)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "Forbidden"));
    }

    const filteredEntries: AdmissionDecision[] = await Models.AdmissionDecision.find({ emailSent: false });
    return res.status(StatusCode.SuccessOK).send(filteredEntries);
});

/**
 * @api {put} /admission/rsvp/accept/ PUT /admission/rsvp/accept/
 * @apiGroup Admission
 * @apiDescription Updates an rsvp for the currently authenticated user (determined by the JWT in the Authorization header).
 *
 * @apiSuccess (200: Success) {string} userId userId
 * @apiSuccess (200: Success) {string} status User's application status
 * @apiSuccess (200: Success) {string} response User's Response (whether or whether not they're attending)
 * @apiSuccess (200: Success) {boolean} emailSent Whether email has been sent
 * @apiSuccess (200: Success) {boolean} reimbursementValue Amount reimbursed
 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
 *      "userId": "github0000001",
 *      "status": "ACCEPTED",
 *      "response": "DECLINED",
 *      "emailSent": true,
 *      "reimbursementValue": 100
 * 	}
 *
 * @apiUse strongVerifyErrors
 * @apiError (409: AlreadyRSVPed) {string} Failed because RSVP has already happened.
 * @apiError (424: EmailFailed) {string} Failed because depencency (mail service) failed.
 */
admissionRouter.put("/rsvp/accept/", strongJwtVerification(), async (_, res, next) => {
    const payload = res.locals.payload;
    const userId: string = payload.id;

    const queryResult: AdmissionDecision | null = await Models.AdmissionDecision.findOne({ userId: userId });

    //Returns error if query is empty
    if (!queryResult) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "UserNotFound"));
    }

    //If the current user has not been accepted, send an error
    if (queryResult.status != DecisionStatus.ACCEPTED) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "NotAccepted"));
    }

    if (queryResult.response != DecisionResponse.PENDING) {
        return next(new RouterError(StatusCode.ClientErrorConflict, "AlreadyRSVPed"));
    }

    const updatedDecision = await performRSVP(queryResult.userId, DecisionResponse.ACCEPTED);

    if (!updatedDecision) {
        return next(new RouterError());
    }

    const application = await getApplication(queryResult.userId);
    if (!application) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "ApplicationNotFound"));
    }

    let mailInfo: MailInfoFormat;
    if (application.requestedTravelReimbursement && (queryResult.reimbursementValue ?? 0) > 0) {
        mailInfo = {
            templateId: RegistrationTemplates.RSVP_CONFIRMATION_WITH_REIMBURSE,
            recipients: [application.emailAddress],
            subs: { name: application.preferredName, amount: queryResult.reimbursementValue },
        };
    } else {
        mailInfo = {
            templateId: RegistrationTemplates.RSVP_CONFIRMATION,
            recipients: [application.emailAddress],
            subs: { name: application.preferredName },
        };
    }

    try {
        await sendMail(mailInfo);
        return res.status(StatusCode.SuccessOK).send(updatedDecision);
    } catch (error) {
        return res.status(StatusCode.ClientErrorFailedDependency).send("EmailFailed");
    }
});

/**
 * @api {put} /admission/rsvp/decline/ PUT /admission/rsvp/decline/
 * @apiGroup Admission
 * @apiDescription Updates an rsvp for the currently authenticated user (determined by the JWT in the Authorization header).
 *
 * @apiSuccess (200: Success) {string} userId userId
 * @apiSuccess (200: Success) {string} status User's application status
 * @apiSuccess (200: Success) {string} response User's Response (whether or whether not they're attending)
 * @apiSuccess (200: Success) {boolean} emailSent Whether email has been sent
 * @apiSuccess (200: Success) {boolean} reimbursementValue Amount reimbursed
 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
 *      "userId": "github0000001",
 *      "status": "ACCEPTED",
 *      "response": "DECLINED",
 *      "emailSent": true,
 *      "reimbursementValue": 100
 * 	}
 *
 * @apiUse strongVerifyErrors
 * @apiError (404: UserNotFound) {string} Failed because user not found.
 * @apiError (404: ApplicationNotFound) {string} Failed because application not found.
 * @apiError (409: AlreadyRSVPed) {string} Failed because RSVP has already happened.
 * @apiError (424: EmailFailed) {string} Failed because depencency (mail service) failed.
 */
admissionRouter.put("/rsvp/decline/", strongJwtVerification(), async (_, res, next) => {
    const payload = res.locals.payload;
    const userId: string = payload.id;

    const queryResult: AdmissionDecision | null = await Models.AdmissionDecision.findOne({ userId: userId });

    //Returns error if query is empty
    if (!queryResult) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "UserNotFound"));
    }

    //If the current user has not been accepted, send an error
    if (queryResult.status != DecisionStatus.ACCEPTED) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "NotAccepted"));
    }

    if (queryResult.response != DecisionResponse.PENDING) {
        return next(new RouterError(StatusCode.ClientErrorConflict, "AlreadyRSVPed"));
    }

    const updatedDecision = await performRSVP(queryResult.userId, DecisionResponse.DECLINED);

    if (!updatedDecision) {
        return next(new RouterError());
    }

    const application = await getApplication(queryResult.userId);
    if (!application) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "ApplicationNotFound"));
    }

    const mailInfo: MailInfoFormat = {
        templateId: RegistrationTemplates.RSVP_DECLINED,
        recipients: [application.emailAddress],
    };

    try {
        await sendMail(mailInfo);
        return res.status(StatusCode.SuccessOK).send(updatedDecision);
    } catch (error) {
        return res.status(StatusCode.ClientErrorFailedDependency).send("EmailFailed");
    }
});

/**
 * @api {put} /admission/update/ PUT /admission/update/
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
 *   {
 *      "userId": "github44285522",
 *      "admittedPro": false,
 *      "reimbursementValue": 100,
 *      "status": "ACCEPTED",
 *      "emailSent": true,
 *      "response": "PENDING"
 *   },
 * {
 *      "userId": "github4fsfs22",
 *      "admittedPro": false,
 *      "reimbursementValue": 50,
 *      "status": "ACCEPTED",
 *      "emailSent": true,
 *      "response": "PENDING"
 *   }
 * ]
 *
 * @apiSuccess (200: Success) {String} StatusSuccess
 *
 * @apiUse strongVerifyErrors
 * @apiError (500: Internal Server Error) {String} InternalError occurred on the server.
 * @apiError (403: Forbidden) {String} Forbidden API accessed by user without valid perms.
 * */
admissionRouter.put("/update/", strongJwtVerification(), async (req, res, next) => {
    const token = res.locals.payload;

    if (!hasElevatedPerms(token)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "Forbidden"));
    }

    const updateEntries: AdmissionDecision[] = req.body as AdmissionDecision[];

    if (!isValidApplicantFormat(updateEntries)) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "BadRequest"));
    }

    // collect emails whose status changed from TBD -> NON-TBD
    const recipients: string[] = [];
    for (let i = 0; i < updateEntries.length; ++i) {
        const existingDecision = await Models.AdmissionDecision.findOne({ userId: updateEntries[i]?.userId });
        if (existingDecision?.status === DecisionStatus.TBD && updateEntries[i]?.status !== DecisionStatus.TBD) {
            const application = await getApplication(existingDecision?.userId);
            if (!application) {
                throw new RouterError(StatusCode.ClientErrorNotFound, "ApplicationNotFound");
            }
            recipients.push(application.emailAddress);
        }
    }

    const ops = updateEntries.map((entry) =>
        Models.AdmissionDecision.findOneAndUpdate(
            { userId: entry.userId },
            {
                $set: {
                    status: entry.status,
                    admittedPro: entry.admittedPro,
                    emailSent: true,
                    reimbursementValue: entry.reimbursementValue,
                },
            },
        ),
    );

    try {
        await Promise.all(ops);

        const mailInfo: MailInfoFormat = {
            templateId: RegistrationTemplates.STATUS_UPDATE,
            recipients: recipients,
        };
        try {
            await sendMail(mailInfo);
            return res.status(StatusCode.SuccessOK).send({ message: "StatusSuccess" });
        } catch (error) {
            return res.status(StatusCode.ClientErrorFailedDependency).send("EmailFailed");
        }
    } catch (error) {
        return next(new RouterError(undefined, undefined, undefined, `${error}`));
    }
});

/**
 * @api {get} /admission/rsvp/ GET /admission/rsvp/
 * @apiGroup Admission
 * @apiDescription Get RSVP decision for current user. Returns applicant's info if non-staff. Returns all RSVP data if staff.
 *
 * @apiSuccess (200: Success) {string} userId
 * @apiSuccess (200: Success) {string} status User's applicatoin status
 * @apiSuccess (200: Success) {string} response User's Response (whether or whether not they're attending)
 * @apiSuccess (200: Success) {string} admittedPro Indicates whether applicant was admitted into pro or not. Reference registration data to determine if their acceptance was deferred or direct.
 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
 *      "userId": "github0000001",
 *      "status": "ACCEPTED",
 *      "response": "ACCEPTED",
 *      "emailSent": true,
 *      "admittedPro": false,
 *      "reimbursementValue": 100
 * 	}
 *
 * @apiUse strongVerifyErrors
 */
admissionRouter.get("/rsvp/", strongJwtVerification(), async (_, res, next) => {
    const payload = res.locals.payload;
    const userId: string = payload.id;

    if (hasElevatedPerms(payload)) {
        const staffQueryResult: AdmissionDecision[] | null = await Models.AdmissionDecision.find();
        //Returns error if query is empty
        if (!staffQueryResult) {
            return next(new RouterError(StatusCode.ClientErrorNotFound, "UserNotFound"));
        }
        return res.status(StatusCode.SuccessOK).send(staffQueryResult);
    }

    const queryResult: AdmissionDecision | null = await Models.AdmissionDecision.findOne({ userId: userId });

    //Returns error if query is empty
    if (!queryResult) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "UserNotFound"));
    }

    return res.status(StatusCode.SuccessOK).send(queryResult);
});

/**
 * @api {get} /admission/rsvp/:USERID/ GET /admission/rsvp/:USERID/
 * @apiGroup Admission
 * @apiDescription Check RSVP decision for a given userId, provided that the authenticated user has elevated perms. If didn't apply pro, admittedPro field won't be part of the response.
 *
 * @apiParam {String} USERID Id to pull the decision for
 *
 * @apiSuccess (200: Success) {string} userId
 * @apiSuccess (200: Success) {string} status User's application status
 * @apiSuccess (200: Success) {string} response User's Response (whether or whether not they're attending)
 * @apiSuccess (200: Success) {boolean} emailSent Whether email has been sent
 * @apiSuccess (200: Success) {int} reimbursementValue Amount reimbursed
 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
 *      "userId": "github0000001",
 *      "status": "ACCEPTED",
 *      "response": "PENDING",
 *      "emailSent": true,
 *      "reimbursementValue": 0
 * 	}
 *
 * @apiUse strongVerifyErrors
 */
admissionRouter.get("/rsvp/:USERID", strongJwtVerification(), async (req, res, next) => {
    const userId: string | undefined = req.params.USERID;

    const payload = res.locals.payload;

    //Sends error if caller doesn't have elevated perms
    if (!hasElevatedPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "Forbidden"));
    }

    const queryResult: AdmissionDecision | null = await Models.AdmissionDecision.findOne({ userId: userId });

    //Returns error if query is empty
    if (!queryResult) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "UserNotFound"));
    }

    return res.status(StatusCode.SuccessOK).send(queryResult);
});

export default admissionRouter;
