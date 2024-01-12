import { StatusCode } from "status-code-enum";
import { NextFunction } from "express-serve-static-core";
import { Request, Response, Router } from "express";

import { RegistrationTemplates } from "../../config.js";
import { strongJwtVerification } from "../../middleware/verify-jwt.js";
import { RouterError } from "../../middleware/error-handler.js";

import Models from "../../database/models.js";
import { RegistrationApplication } from "../../database/registration-db.js";
import { AdmissionDecision, DecisionStatus } from "../../database/admission-db.js";

import { Degree, Gender } from "./registration-models.js";
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
 * @apiSuccess (200: Success) {String} userId UserID
 * @apiSuccess (200: Success) {String} preferredName User's preffered name
 * @apiSuccess (200: Success) {String} userName User's online username
 * @apiSuccess (200: Success) {String} resume A FILLER VALUE FOR NOW, WE NEED TO FIGURE OUT HOW TO STORE RESUMES
 * @apiSuccess (200: Success) {String[]} essays User's essays
 * 
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 * {
        "userId": "user123",
        "preferredName": "John",
        "userName": "john21",
        "resume": "john-doe-resume.pdf",
        "essays": [
            "essay 1",
            "essay 2"
        ]
    }
 * @apiError (400: Bad Request) {String} User not found in Database
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 400 Bad Request
 *     {"error": "UserNotFound"}
 */
registrationRouter.get("/", strongJwtVerification, async (_: Request, res: Response) => {
    const defaultResponse = {
        userId: "",
        isProApplicant: false,
        considerForGeneral: true,
        preferredName: "",
        legalName: "",
        emailAddress: "",
        gender: Gender.OTHER,
        race: [],
        requestedTravelReimbursement: false,
        location: "",
        degree: Degree.OTHER,
        university: "",
        gradYear: 0,
        hackInterest: [],
        hackOutreach: [],
        dietaryRestrictions: [],
        hackEssay1: "",
        hackEssay2: "",
        optionalEssay: "",
        proEssay: "",
    };
    const payload: JwtPayload = res.locals.payload;
    const registrationData: RegistrationApplication | null = await Models.RegistrationApplications.findOne({
        userId: payload.id,
    });
    return res.status(StatusCode.SuccessOK).send(registrationData ?? defaultResponse);
});

/**
 * @api {get} /registration/:USERID GET /registration/:USERID
 * @apiGroup Registration
 * @apiDescription Gets registration data for a specific user, provided that the authenticated user has elevated perms
 *
 * @apiSuccess (200: Success) {String} userId UserID
 * @apiSuccess (200: Success) {String} preferredName User's preffered name
 * @apiSuccess (200: Success) {String} userName User's online username
 * @apiSuccess (200: Success) {String} resume A FILLER VALUE FOR NOW, WE NEED TO FIGURE OUT HOW TO STORE RESUMES
 * @apiSuccess (200: Success) {String[]} essays User's essays
 * 
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 * {
        "userId": "user123",
        "preferredName": "John",
        "userName": "john21",
        "resume": "john-doe-resume.pdf",
        "essays": [
            "essay 1",
            "essay 2"
        ]
    }
 * @apiError (400: Bad Request) {String} User not found in Database
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 400 Bad Request
 *     {"error": "UserNotFound"}
 */
registrationRouter.get("/userid/:USERID", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const userId: string | undefined = req.params.USERID;
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    if (!hasElevatedPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "Forbidden"));
    }

    const registrationData: RegistrationApplication | null = await Models.RegistrationApplications.findOne({ userId: userId });

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
 * @apiBody {string} userId UserID
 * @apiBody {string} preferredName User's preffered name
 * @apiBody {string} userName User's online username
 * @apiBody {string} resume A FILLER VALUE FOR NOW, WE NEED TO FIGURE OUT HOW TO STORE RESUMES
 * @apiBody {string[]} essays User's essays
 * @apiParamExample {json} Example Request:
 * {
        "userId": "user123",
        "preferredName": "John",
        "userName": "john21",
        "resume": "john-doe-resume.pdf",
        "essays": ["essay 1", "essay 2"]
 * }
 *
 * @apiSuccess (200: Success) {string} newRegistrationInfo The newly created object in registration/info
 * @apiSuccess (200: Success) {string} newRegistrationApplication The newly created object in registration/application
 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
        "newRegistrationInfo": {
            "userId": "user123",
            "preferredName": "John",
            "userName": "john21",
            "_id": "655110b6e84015eeea310fe0"
        },
        "newRegistrationApplication": {
            "userId": "user123",
            "resume": "john-doe-resume.pdf",
            "essays": [
                "essay 1",
                "essay 2"
            ],
            "_id": "655110b6e84015eeea310fe2"
        }
    }
 * 
 * @apiError (400: Bad Request) {String} User already exists in Database
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 400 Bad Request
 *     {"error": "UserAlreadyExists"}
 *
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

    const registrationInfo: RegistrationApplication | null = await Models.RegistrationApplications.findOne({ userId: userId });
    if (registrationInfo?.hasSubmitted ?? false) {
        return next(new RouterError(StatusCode.ClientErrorUnprocessableEntity, "AlreadySubmitted"));
    }

    const newRegistrationInfo: RegistrationApplication | null = await Models.RegistrationApplications.findOneAndReplace(
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

    const registrationInfo: RegistrationApplication | null = await Models.RegistrationApplications.findOne({ userId: userId });

    if (!registrationInfo) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "NoRegistrationInfo"));
    }

    if (registrationInfo?.hasSubmitted ?? false) {
        return next(new RouterError(StatusCode.ClientErrorUnprocessableEntity, "AlreadySubmitted"));
    }

    const newRegistrationInfo: RegistrationApplication | null = await Models.RegistrationApplications.findOneAndUpdate(
        { userId: userId },
        { hasSubmitted: true },
        { new: true },
    );
    if (!newRegistrationInfo) {
        return next(new RouterError(StatusCode.ServerErrorInternal, "InternalError"));
    }

    const admissionInfo: AdmissionDecision | null = await Models.AdmissionDecision.findOneAndUpdate(
        {
            userId: userId,
        },
        { status: DecisionStatus.TBD },
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
