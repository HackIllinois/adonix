import { StatusCode } from "status-code-enum";
import { NextFunction } from "express-serve-static-core";
import { Request, Response, Router } from "express";

import { RegistrationTemplates } from "../../config.js";
import { strongJwtVerification } from "../../middleware/verify-jwt.js";
import { RouterError } from "../../middleware/error-handler.js";

import Models from "../../database/models.js";
import { RegistrationApplication } from "../../database/registration-db.js";
import { AdmissionDecision, DecisionResponse, DecisionStatus } from "../../database/admission-db.js";

import { RegistrationFormat, isValidRegistrationFormat } from "./registration-formats.js";

import { hasElevatedPerms } from "../auth/auth-lib.js";
import { JwtPayload } from "../auth/auth-models.js";

import { sendMailWrapper } from "../mail/mail-lib.js";
import { MailInfoFormat } from "../mail/mail-formats.js";

const registrationRouter: Router = Router();

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
 *      "degree": "Masters",
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
 */
registrationRouter.get("/", strongJwtVerification, async (_: Request, res: Response, next: NextFunction) => {
    const payload: JwtPayload = res.locals.payload;
    const registrationData: RegistrationApplication | null = await Models.RegistrationApplication.findOne({
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
 *      "degree": "Masters",
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
 * @apiError (404: Not Found) {String} UserNotFound User not found in database
 */
registrationRouter.get("/userid/:USERID", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const userId: string | undefined = req.params.USERID;
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    if (!hasElevatedPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "Forbidden"));
    }

    const registrationData: RegistrationApplication | null = await Models.RegistrationApplication.findOne({ userId: userId });

    if (!registrationData) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "UserNotFound"));
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
 *     "preferredName": "Ronakin",
 *      "legalName": "Ronakin Kanandini",
 *      "emailAddress": "rpak@gmail.org",
 *      "university": "University of Illinois Urbana-Champaign",
 *      "hackEssay1": "I love hack",
 *      "hackEssay2": "I love hack",
 *      "optionalEssay": "",
 *      "resumeFileName": "https://www.google.com",
 *      "location": "Urbana",
 *      "gender": ["Prefer Not To Answer"],
 *      "degree": "Masters",
 *      "major": "Computer Science",
 *      "minor": "Math",
 *      "resumeFileName": "https://www.google.com/"
 *      "gradYear": 0,
 *      "isProApplicant": true,
 *      "proEssay": "I wanna be a Knight",
 *      "considerForGeneral": true,
 *      "requestedTravelReimbursement: false,
 *      "dietaryRestrictions": "Vegetarian",
 *      "race": "Prefer Not To Answer",
 *      "hackInterest": ["Mini-Event"],
 *      "hackOutreach": ["Instagram"]
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
 *      "degree": "Masters",
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
    const payload: JwtPayload = res.locals.payload as JwtPayload;
    const userId: string = payload.id;

    const registrationData: RegistrationFormat = req.body as RegistrationFormat;
    registrationData.userId = userId;

    if (!isValidRegistrationFormat(registrationData)) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "BadRequest"));
    }

    const registrationInfo: RegistrationApplication | null = await Models.RegistrationApplication.findOne({ userId: userId });
    if (registrationInfo?.hasSubmitted ?? false) {
        return next(new RouterError(StatusCode.ClientErrorUnprocessableEntity, "AlreadySubmitted"));
    }

    const newRegistrationInfo: RegistrationApplication | null = await Models.RegistrationApplication.findOneAndReplace(
        { userId: userId },
        registrationData,
        { upsert: true, new: true },
    );

    if (!newRegistrationInfo) {
        return next(new RouterError(StatusCode.ServerErrorInternal, "InternalError"));
    }

    return res.status(StatusCode.SuccessOK).send(newRegistrationInfo);
});

// THIS ENDPOINT SHOULD PERFORM ALL THE ACTIONS REQUIRED ONCE YOU SUBMIT REGISTRATION
registrationRouter.post("/submit/", strongJwtVerification, async (_: Request, res: Response, next: NextFunction) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;
    const userId: string = payload.id;

    const registrationInfo: RegistrationApplication | null = await Models.RegistrationApplication.findOne({ userId: userId });

    if (!registrationInfo) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "NoRegistrationInfo"));
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

    const admissionDecision = new AdmissionDecision(userId, DecisionStatus.TBD, DecisionResponse.PENDING, "", false);

    const admissionInfo: AdmissionDecision | null = await Models.AdmissionDecision.findOneAndUpdate(
        {
            userId: userId,
        },
        admissionDecision,
        { upsert: true, new: true },
    );

    if (!admissionInfo) {
        return next(new RouterError(StatusCode.ServerErrorInternal, "InternalError"));
    }

    // SEND SUCCESFUL REGISTRATION EMAIL
    const mailInfo: MailInfoFormat = {
        templateId: RegistrationTemplates.REGISTRATION_SUBMISSION,
        recipients: [registrationInfo.emailAddress],
    };
    return sendMailWrapper(res, next, mailInfo);
});

export default registrationRouter;
