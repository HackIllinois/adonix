import { StatusCode } from "status-code-enum";
import { NextFunction } from "express-serve-static-core";
import { Request, Response, Router } from "express";

import { RegistrationTemplates } from "../../common/config";
import { strongJwtVerification } from "../../middleware/verify-jwt";
import { RouterError } from "../../middleware/error-handler";

import Models from "../../database/models";
import { RegistrationApplication } from "../../database/registration-db";
import { AdmissionDecision, DecisionStatus } from "../../database/admission-db";

import { RegistrationFormat, isValidRegistrationFormat } from "./registration-formats";

import { hasElevatedPerms } from "../../common/auth";
import { JwtPayload } from "../auth/auth-schemas";

import { sendMail } from "../mail/mail-lib";
import { MailInfo } from "../mail/mail-schemas";
import { isRegistrationAlive } from "./registration-lib";

const registrationRouter = Router();

registrationRouter.get("/status/", async (_: Request, res: Response) => {
    const isAlive = isRegistrationAlive();
    return res.status(StatusCode.SuccessOK).send({ alive: isAlive });
});

/**
 * @api {get} /registration/ GET /registration/
 * @apiGroup Registration
 * @apiDescription Gets registration data for the current user in the JWT token.
 *
 * @apiSuccess (200: Success) {String} preferredName Applicant's preffered name
 * @apiSuccess (200: Success) {String} legalName Applicant's full legal name
 * @apiSuccess (200: Success) {String} emailAddress Applicant's email
 * @apiSuccess (200: Success) {String} hackEssay1 First required essay
 * @apiSuccess (200: Success) {String} hackEssay2 Second required essay
 * @apiSuccess (200: Success) {String} optionalEssay Space for applicant to share additional thoughts
 * @apiSuccess (200: Success) {String} location Applicant's location
 * @apiSuccess (200: Success) {String} gender Applicant's gender
 * @apiSuccess (200: Success) {String} degree Applicant's pursued degree
 * @apiSuccess (200: Success) {String} major Applicant's pursued major
 * @apiSuccess (200: Success) {String} minor Applicant's pursued minor (optional)
 * @apiSuccess (200: Success) {String} gradYear Applicant's graduation year
 * @apiSuccess (200: Success) {Boolean} isProApplicant True/False indicating if they are a pro applicant
 * @apiSuccess (200: Success) {String} proEssay Third essay (required for Knights, empty string for General)
 * @apiSuccess (200: Success) {Boolean} considerForGeneral True/False indicating if pro attendee wants to be considered for general
 * @apiSuccess (200: Success) {Boolean} requestedTravelReimbursement True/False indicating if applicant requested reimbursement
 * @apiSuccess (200: Success) {String} dietaryRestrictions Attendee's restrictions, include provided options and append any custom restrictions as provided by attendee
 * @apiSuccess (200: Success) {String[]} race True/False Attendee's race/ethnicity
 * @apiSuccess (200: Success) {String[]} hackInterest  What the attendee is interested in for the event (multi-select)
 * @apiSuccess (200: Success) {String[]} hackOutreach How the attendee found us  (multi-select)
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 * {
 *  @apiSuccess (200: Success) {String} userId Applicant's userId
 *      "userId":"user1234",
 *      "preferredName": "Ronakin",
 *      "legalName": "Ronakin Kanandini",
 *      emailAddress: "rpak@gmail.org",
 *      "university": "University of Illinois Urbana-Champaign",
 *      "hackEssay1": "I love hack",
 *      "hackEssay2": "I love hack",
 *      "optionalEssay": "",
 *      "resumeFileName": "https://www.google.com",
 *      "location": "Urbana",
 *      "gender": ["Prefer Not To Answer"],
 *      "degree": "Associates' Degree",
 *      "gradYear": 0,
 *      "isProApplicant": true,
 *      "proEssay": "I wanna be a Knight",
 *      "considerForGeneral": true,
 *      "requestedTravelReimbursement: false,
 *      "dietaryRestrictions": "Vegetarian",
 *      "race": "Prefer Not To Answer",
 *      "hackInterest": ["Mini-Event"],
 *      "hackOutreach": ["Instagram"]
 *  }
 * @apiError (404: Not Found) {String} NotFound Registration does not exist
 * @apiUse strongVerifyErrors
 */
registrationRouter.get("/", strongJwtVerification, async (_: Request, res: Response, next: NextFunction) => {
    const payload = res.locals.payload;
    const registrationData = await Models.RegistrationApplication.findOne({
        userId: payload.id,
    });

    if (!registrationData) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "NotFound"));
    }

    return res.status(StatusCode.SuccessOK).send(registrationData);
});

/**
 * @api {get} /registration/:USERID GET /registration/:USERID
 * @apiGroup Registration
 * @apiDescription Gets registration data for a specific user, provided that the authenticated user has elevated perms
 *
 * @apiSuccess (200: Success) {String} userId Applicant's userId
 * @apiSuccess (200: Success) {String} preferredName Applicant's preffered name
 * @apiSuccess (200: Success) {String} legalName Applicant's full legal name
 * @apiSuccess (200: Success) {String} emailAddress Applicant's email
 * @apiSuccess (200: Success) {String} hackEssay1 First required essay
 * @apiSuccess (200: Success) {String} hackEssay2 Second required essay
 * @apiSuccess (200: Success) {String} optionalEssay Space for applicant to share additional thoughts
 * @apiSuccess (200: Success) {String} location Applicant's location
 * @apiSuccess (200: Success) {String} gender Applicant's gender
 * @apiSuccess (200: Success) {String} degree Applicant's pursued degree
 * @apiSuccess (200: Success) {String} major Applicant's pursued major
 * @apiSuccess (200: Success) {String} minor Applicant's pursued minor (optional)
 * @apiSuccess (200: Success) {String} gradYear Applicant's graduation year
 * @apiSuccess (200: Success) {Boolean} isProApplicant True/False indicating if they are a pro applicant
 * @apiSuccess (200: Success) {String} proEssay Third essay (required for Knights, empty string for General)
 * @apiSuccess (200: Success) {Boolean} considerForGeneral True/False indicating if pro attendee wants to be considered for general
 * @apiSuccess (200: Success) {Boolean} requestedTravelReimbursement True/False indicating if applicant requested reimbursement
 * @apiSuccess (200: Success) {String} dietaryRestrictions Attendee's restrictions, include provided options and append any custom restrictions as provided by attendee
 * @apiSuccess (200: Success) {String[]} race True/False Attendee's race/ethnicity
 * @apiSuccess (200: Success) {String[]} hackInterest  What the attendee is interested in for the event (multi-select)
 * @apiSuccess (200: Success) {String[]} hackOutreach How the attendee found us  (multi-select)
 *
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 * {
 *      "userId":"user1234",
 *      "preferredName": "Ronakin",
 *      "legalName": "Ronakin Kanandini",
 *      emailAddress: "rpak@gmail.org",
 *      "university": "University of Illinois Urbana-Champaign",
 *      "hackEssay1": "I love hack",
 *      "hackEssay2": "I love hack",
 *      "optionalEssay": "",
 *      "location": "Urbana",
 *      "gender": ["Prefer Not To Answer"],
 *      "degree": "Associates' Degree",
 *      "major": "Computer Science",
 *      "minor": "Math",
 *      "resumeFileName": "https://www.google.com",
 *      "gradYear": 0,
 *      "isProApplicant": true,
 *      "proEssay": "I wanna be a Knight",
 *      "considerForGeneral": true,
 *      "requestedTravelReimbursement: false,
 *      "dietaryRestrictions": "Vegetarian",
 *      "race": "Prefer Not To Answer",
 *      "hackInterest": ["Mini-Event"],
 *      "hackOutreach": ["Instagram"]
 *  }
 * @apiError (403: Forbidden) {String} Forbidden User doesn't have elevated permissions
 * @apiError (404: Not Found) {String} NotFound Registration does not exist
 */
registrationRouter.get("/userid/:USERID", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.params.USERID;
    const payload = res.locals.payload as JwtPayload;

    if (!hasElevatedPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "Forbidden"));
    }

    const registrationData: RegistrationApplication | null = await Models.RegistrationApplication.findOne({ userId: userId });

    if (!registrationData) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "NotFound"));
    }

    return res.status(StatusCode.SuccessOK).send(registrationData);
});

/**
 * @api {post} /registration/ POST /registration/
 * @apiGroup Registration
 * @apiDescription Creates registration data for the current user
 *
 * @apiBody (200: Success) {String} preferredName Applicant's preffered name
 * @apiBody (200: Success) {String} legalName Applicant's full legal name
 * @apiBody (200: Success) {String} emailAddress Applicant's email
 * @apiBody (200: Success) {String} hackEssay1 First required essay
 * @apiBody (200: Success) {String} hackEssay2 Second required essay
 * @apiBody (200: Success) {String} optionalEssay Space for applicant to share additional thoughts
 * @apiBody (200: Success) {String} location Applicant's location
 * @apiBody (200: Success) {String} gender Applicant's gender
 * @apiBody (200: Success) {String} degree Applicant's pursued degree
 * @apiBody (200: Success) {String} major Applicant's pursued major
 * @apiBody (200: Success) {String} minor Applicant's pursued minor (optional)
 * @apiBody (200: Success) {String} gradYear Applicant's graduation year
 * @apiBody (200: Success) {Boolean} isProApplicant True/False indicating if they are a pro applicant
 * @apiBody (200: Success) {String} proEssay Third essay (required for Knights, empty string for General)
 * @apiBody (200: Success) {Boolean} considerForGeneral True/False indicating if pro attendee wants to be considered for general
 * @apiBody (200: Success) {Boolean} requestedTravelReimbursement True/False indicating if applicant requested reimbursement
 * @apiBody (200: Success) {String} dietaryRestrictions Attendee's restrictions, include provided options and append any custom restrictions as provided by attendee
 * @apiBody (200: Success) {String[]} race True/False Attendee's race/ethnicity
 * @apiBody (200: Success) {String[]} hackInterest  What the attendee is interested in for the event (multi-select)
 * @apiBody (200: Success) {String[]} hackOutreach How the attendee found us  (multi-select)
 *
 * @apiParamExample {json} Example Request:
 * {
 *     "preferredName": "L",
 *     "emailAddress": "wjiwji1j@illinois.edu",
 *     "location": "Alaska",
 *     "degree": "Associates' Degree",
 *     "university": "University of Illinois (Springfield)",
 *     "major": "Computer Science",
 *     "minor": "Computer Science",
 *     "gradYear": 2030,
 *     "hackEssay1": "yay",
 *     "hackEssay2": "yay",
 *     "proEssay": "yay",
 *     "hackInterest": [
 *         "Attending technical workshops"
 *     ],
 *     "hackOutreach": [
 *         "Instagram"
 *     ],
 *     "dietaryRestrictions": [
 *         "None"
 *     ],
 *     "resumeFileName": "GitHub cheatsheet.pdf",
 *     "isProApplicant": false,
 *     "legalName": "lasya neti",
 *     "considerForGeneral": false,
 *     "requestedTravelReimbursement": true,
 *     "gender": "Female",
 *     "race": [
 *         "American Indian or Alaska Native"
 *     ],
 *     "optionalEssay": ""
 * }
 *
 * @apiSuccess (200: Success) {json} json Returns the POSTed registration information for user
 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
 *      "userId": "user123",
 *      "preferredName": "Ronakin",
 *      "legalName": "Ronakin Kanandini",
 *      "emailAddress": "rpak@gmail.org",
 *      "university": "University of Illinois Urbana-Champaign",
 *      "hackEssay1": "I love hack",
 *      "hackEssay2": "I love hack",
 *      "optionalEssay": "I wanna be a Knight",
 *      "location": "Urbana",
 *      "gender": "Prefer Not To Answer",
 *      "degree": "Associates' Degree",
 *      "major": "Computer Science",
 *      "minor": "Math",
 *      "resumeFileName": "https://www.google.com/"
 *      "gradYear": 0,
 *      "isProApplicant": true,
 *      "proEssay": "I wanna be a Knight",
 *      "considerForGeneral": true,
 *      "requestedTravelReimbursement: false.
 *      "dietaryRestrictions": "Vegetarian"
 *      "race": "Prefer Not To Answer"
 *      "hackInterest": "Mini-Event"
 *      "hackOutreach": "Instagram"
 *  }
 *
 * @apiError (400: Bad Request) {String} UserAlreadyExists User already exists in Database
 * @apiError (422: Unprocessable Entity) {String} AlreadySubmitted User already submitted application (cannot POST more than once)
 * @apiError (500: Internal Server Error) {String} InternalError Server-side error
 * @apiUse strongVerifyErrors
 */
registrationRouter.post("/", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const payload = res.locals.payload as JwtPayload;
    const userId = payload.id;

    const registrationData = req.body as RegistrationFormat;
    registrationData.userId = userId;

    if (!isValidRegistrationFormat(registrationData)) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "BadRequest"));
    }

    const registrationInfo = await Models.RegistrationApplication.findOne({ userId: userId });
    if (registrationInfo?.hasSubmitted ?? false) {
        return next(new RouterError(StatusCode.ClientErrorUnprocessableEntity, "AlreadySubmitted"));
    }

    const newRegistrationInfo = await Models.RegistrationApplication.findOneAndReplace({ userId: userId }, registrationData, {
        upsert: true,
        new: true,
    });

    if (!newRegistrationInfo) {
        return next(new RouterError(StatusCode.ServerErrorInternal, "InternalError"));
    }

    return res.status(StatusCode.SuccessOK).send(newRegistrationInfo);
});

/**
 * @api {post} /registration/submit/ POST /registration/submit/
 * @apiGroup Registration
 * @apiDescription Submits registration data for the current user. Cannot edit registration data after this point.
 *
 * No body is required for this request.
 *
 * @apiSuccess (200: Success) {String} Success
 * @apiError (404: Bad Request) {String} NotFound Registration does not exist
 * @apiError (422: Unprocessable Entity) {String} AlreadySubmitted User already submitted application (cannot POST more than once)
 * @apiError (500: Internal Server Error) {String} InternalError Server-side error
 **/
registrationRouter.post("/submit/", strongJwtVerification, async (_: Request, res: Response, next: NextFunction) => {
    if (!isRegistrationAlive()) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "RegistrationClosed"));
    }

    const payload = res.locals.payload as JwtPayload;
    const userId = payload.id;

    const registrationInfo = await Models.RegistrationApplication.findOne({ userId: userId });

    if (!registrationInfo) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "NotFound"));
    }

    if (registrationInfo?.hasSubmitted ?? false) {
        return next(new RouterError(StatusCode.ClientErrorUnprocessableEntity, "AlreadySubmitted"));
    }

    const newRegistrationInfo: RegistrationApplication | null = await Models.RegistrationApplication.findOneAndUpdate(
        { userId: userId },
        { hasSubmitted: true },
        { new: true },
    );

    if (!newRegistrationInfo) {
        return next(new RouterError(StatusCode.ServerErrorInternal, "InternalError"));
    }

    const admissionDecision: AdmissionDecision = {
        userId,
        status: DecisionStatus.TBD,
    };

    const admissionInfo = await Models.AdmissionDecision.findOneAndUpdate(
        {
            userId: userId,
        },
        admissionDecision,
        { upsert: true, new: true },
    );

    if (!admissionInfo) {
        return next(new RouterError(StatusCode.ServerErrorInternal, "InternalError"));
    }

    // SEND SUCCESSFUL REGISTRATION EMAIL
    const mailInfo: MailInfo = {
        templateId: RegistrationTemplates.REGISTRATION_SUBMISSION,
        recipients: [registrationInfo.emailAddress],
        subs: { name: registrationInfo.preferredName },
    };

    try {
        await sendMail(mailInfo);
    } catch (error) {
        return next(new RouterError(StatusCode.ServerErrorInternal, "EmailFailedToSend", error, error.toString()));
    }

    return res.status(StatusCode.SuccessOK).send(newRegistrationInfo);
});

export default registrationRouter;
