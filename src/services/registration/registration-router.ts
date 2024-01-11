import { Request, Response, Router } from "express";
import { strongJwtVerification } from "../../middleware/verify-jwt.js";

import Models from "../../database/models.js";
import { RegistrationApplication } from "../../database/registration-db.js";
import { hasElevatedPerms } from "../auth/auth-lib.js";
import { JwtPayload } from "../auth/auth-models.js";
import { RegistrationFormat, isValidRegistrationFormat } from "./registration-formats.js";

import { StatusCode } from "status-code-enum";
import { Degree, Gender } from "./registration-models.js";

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
        email: "",
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
registrationRouter.get("/:USERID", strongJwtVerification, async (req: Request, res: Response) => {
    const userId: string | undefined = req.params.USERID;
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    //Sends error if caller doesn't have elevated perms
    if (!hasElevatedPerms(payload)) {
        // TODO: CALL ERROR HANDLER ROUTER
        return res.status(StatusCode.ClientErrorForbidden).send({ error: "Forbidden" });
    }

    const registrationData: RegistrationApplication | null = await Models.RegistrationApplications.findOne({ userId: userId });

    if (!registrationData) {
        // TODO: CALL ERROR HANDLER ROUTER
        return res.status(StatusCode.ClientErrorNotFound).send({ error: "UserNotFound" });
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
registrationRouter.post("/", strongJwtVerification, async (req: Request, res: Response) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;
    const userId: string = payload.id;

    const registrationData: RegistrationFormat = req.body as RegistrationFormat;
    if (!isValidRegistrationFormat(registrationData)) {
        // TODO: CALL ERROR HANDLER ROUTER
        return res.status(StatusCode.ClientErrorBadRequest).send({ error: "BadRequest" });
    }

    const newRegistrationInfo: RegistrationApplication | null =  await Models.RegistrationApplications.findOneAndReplace(
        { userId: userId },
        registrationData,
        { upsert: true, new: true},
    );

    if (!newRegistrationInfo) {
        // TODO: CALL ERROR HANDLER ROUTER
        return res.status(StatusCode.ServerErrorInternal).send({ error: "InternalError" });
    }

    // TODO: S3 API TO GENERATE RESUME LINK AND SEND IT OVER WITH THIS INFO
    return res.status(StatusCode.SuccessOK).send(newRegistrationInfo);
});

export default registrationRouter;
