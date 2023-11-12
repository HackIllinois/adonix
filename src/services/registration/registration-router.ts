import { Router, Request, Response } from "express";
import { strongJwtVerification } from "../../middleware/verify-jwt.js";

import { JwtPayload } from "../auth/auth-models.js";
import Models from "../../database/models.js";
import { RegistrationInfo, RegistrationApplication } from "../../database/registration-db.js";
import { hasElevatedPerms } from "../auth/auth-lib.js";
import { UpdateRegistrationRecord } from "./registration-formats.js";

import { StatusCode } from "status-code-enum";

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
    const payload: JwtPayload = res.locals.payload as JwtPayload;
    const userId: string = payload.id;

    const queryResultInfo: RegistrationInfo | null = await Models.RegistrationInfo.findOne({ userId: userId });
    const queryResultApp: RegistrationApplication | null = await Models.RegistrationApplication.findOne({ userId: userId });

    //Returns error if query is empty
    if (!queryResultInfo || !queryResultApp) {
        return res.status(StatusCode.ClientErrorBadRequest).send({ error: "UserNotFound" });
    }

    return res.status(StatusCode.SuccessOK).send({
        userId: queryResultInfo.userId,
        preferredName: queryResultInfo.preferredName,
        userName: queryResultInfo.userName,
        resume: queryResultApp.resume,
        essays: queryResultApp.essays,
    });
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
        return res.status(StatusCode.ClientErrorForbidden).send({ error: "Forbidden" });
    }

    const queryResultInfo: RegistrationInfo | null = await Models.RegistrationInfo.findOne({ userId: userId });
    const queryResultApp: RegistrationApplication | null = await Models.RegistrationApplication.findOne({ userId: userId });

    //Returns error if query is empty
    if (!queryResultInfo || !queryResultApp) {
        return res.status(StatusCode.ClientErrorBadRequest).send({ error: "UserNotFound" });
    }

    return res.status(StatusCode.SuccessOK).send({
        userId: queryResultInfo.userId,
        preferredName: queryResultInfo.preferredName,
        userName: queryResultInfo.userName,
        resume: queryResultApp.resume,
        essays: queryResultApp.essays,
    });
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

    const data: UpdateRegistrationRecord = req.body as UpdateRegistrationRecord;

    //Checks if the user is already in the database
    const queryResultInfo: RegistrationInfo | null = await Models.RegistrationInfo.findOne({ userId: userId });

    //Returns error if the user is already in the database
    if (queryResultInfo) {
        return res.status(StatusCode.ClientErrorBadRequest).send({ error: "UserAlreadyExists" });
    }

    //NOTE: The resume field is just a filler field right now, we'll have to find a way to store resumes
    //Create objects in each collection
    const newRegistrationInfo: RegistrationInfo | null = await Models.RegistrationInfo.create({
        userId: userId,
        preferredName: data.preferredName,
        userName: data.userName,
    });
    const newRegistrationApplication: RegistrationApplication | null = await Models.RegistrationApplication.create({
        userId: userId,
        resume: data.resume,
        essays: data.essays,
    });

    return res.status(StatusCode.SuccessOK).send({ newRegistrationInfo, newRegistrationApplication });
});

/**
 * @api {put} /registration/ PUT /registration/
 * @apiGroup Registration
 * @apiDescription Updates registration data for the current user
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
 * @apiSuccess (200: Success) {string} updatedRegistrationInfo The updated object in registration/info
 * @apiSuccess (200: Success) {string} updatedRegistrationApplication The updated object in registration/application
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
 * @apiError (400: Bad Request) {String} User doesn't exists in Database
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 400 Bad Request
 *     {"error": "UserNotFound"}
 *
 * @apiUse strongVerifyErrors
 */
registrationRouter.put("/", strongJwtVerification, async (req: Request, res: Response) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;
    const userId: string = payload.id;

    const data: UpdateRegistrationRecord = req.body as UpdateRegistrationRecord;

    //check if user exists in database
    const queryResultInfo: RegistrationInfo | null = await Models.RegistrationInfo.findOne({ userId: userId });
    const queryResultApplication: RegistrationApplication | null = await Models.RegistrationInfo.findOne({ userId: userId });

    //Returns error if query is empty
    if (!queryResultInfo || !queryResultApplication) {
        return res.status(StatusCode.ClientErrorBadRequest).send({ error: "UserNotFound" });
    }

    const updatedRegistrationInfo: RegistrationInfo | null = await Models.RegistrationInfo.findOneAndUpdate(
        { userId: userId },
        {
            preferredName: data.preferredName,
            userName: data.userName,
        },
        { new: true },
    );

    const updatedRegistrationApplication: RegistrationApplication | null = await Models.RegistrationApplication.findOneAndUpdate(
        { userId: userId },
        {
            resume: data.resume,
            essays: data.essays,
        },
        { new: true },
    );

    return res.status(StatusCode.SuccessOK).send({ updatedRegistrationInfo, updatedRegistrationApplication });
});

export default registrationRouter;
