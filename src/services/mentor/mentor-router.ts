import { Request, Response, Router } from "express";
import { OfficeHoursFormat, pointCoinUpdateValue } from "./mentor-formats.js";
import Models from "../../database/models.js";
import { StatusCode } from "status-code-enum";
import { strongJwtVerification } from "../../middleware/verify-jwt.js";
import { JwtPayload } from "../auth/auth-models.js";
import { hasElevatedPerms } from "../auth/auth-lib.js";
import { RouterError } from "../../middleware/error-handler.js";
import { NextFunction } from "express-serve-static-core";
import { updatePoints, updateCoins } from "../profile/profile-lib.js";
import Config from "../../config.js";
import crypto from "crypto";

const mentorRouter: Router = Router();

/**
 * @api {post} /mentor POST /mentor
 * @apiGroup Mentor
 * @apiDescription Create a mentor's office hours in the database.
 *
 * @apiBody {String} mentorName name of the mentor to add
 * @apiParamExample {json} Example Request:
 * { "mentorName": "Jojos" }
 *
 * @apiSuccess (201: Success) {Json} success Indicates successful creation of the mentor's office hours.
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 201 CREATED
 * {
 *     "mentorId": "7072a6565209be28b4e3e8a3a3e5810e",
 *     "mentorName": "Jojos",
 *     "attendees": [],
 *     "_id": "65ad7fcd5d7f20c924270947"
 * }
 *
 * @apiError (400: Invalid Request) {String} InvalidRequest
 * @apiErrorExample Example Error Response (InvalidRequest):
 *     HTTP/1.1 400 Invalid Request
 *     {"error": "InvalidRequest"}
 *
 * @apiError (403: Invalid Permission) {String} InvalidPermission Caller has invalid permissions.
 * @apiErrorExample Example Error Response (InvalidPermission):
 *     HTTP/1.1 403 Invalid Permission
 *     {"error": "InvalidPermission"}
 */
mentorRouter.post("/", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const mentorName: string | undefined = req.body.mentorName;
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    if (!mentorName) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "InvalidRequest"));
    }
    if (!hasElevatedPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "InvalidPermission"));
    }

    //generate mentorId, add document to database, return generated document in response
    const mentorId: string = crypto.randomBytes(Config.MENTOR_BYTES_GEN).toString("hex");

    const officeHours: OfficeHoursFormat = { mentorId: mentorId, mentorName: mentorName, attendees: [] };

    const newOfficeHours = await Models.MentorOfficeHours.create(officeHours);

    return res.status(StatusCode.SuccessCreated).send(newOfficeHours);
});

/**
 * @api {get} /mentor GET /mentor
 * @apiGroup Mentor
 * @apiDescription Get all mentors office hours.
 *
 * @apiSuccess (200: Success) {Json} success Indicates successful getting of all mentors office hours.
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 * [
 *  {
 *     "_id": "65ad734fc840a099ca27c7f2",
 *     "mentorId": "90c0ed9f97dc08f318cefe0f733384d4",
 *     "mentorName": "Joe",
 *     "attendees": [
 *         "google107002865535727235753"
 *     ]
 * },
 * {
 *     "_id": "65ad7fcd5d7f20c924270947",
 *     "mentorId": "7072a6565209be28b4e3e8a3a3e5810e",
 *     "mentorName": "Jojos",
 *     "attendees": []
 * }
 * ]
 *
 * @apiError (403: Invalid Permission) {String} InvalidPermission Caller has invalid permissions.
 * @apiErrorExample Example Error Response (InvalidPermission):
 *     HTTP/1.1 403 Invalid Permission
 *     {"error": "InvalidPermission"}
 *
 * @apiError (500: Internal Error) {String} InternalError An internal server error occurred.
 * @apiErrorExample Example Error Response (InternalError):
 *     HTTP/1.1 500 Internal Server Error
 *     {"error": "InternalError"}
 */
mentorRouter.get("/", strongJwtVerification, async (_: Request, res: Response, next: NextFunction) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    if (!hasElevatedPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "InvalidPermission"));
    }

    const officeHours: OfficeHoursFormat[] | null = await Models.MentorOfficeHours.find();

    if (!officeHours) {
        return next(new RouterError(StatusCode.ServerErrorInternal, "InternalError"));
    }

    return res.status(StatusCode.SuccessOK).send(officeHours);
});

/**
 * @api {delete} /mentor DELETE /mentor
 * @apiGroup Mentor
 * @apiDescription Delete a mentor's office hours in the database.
 *
 * @apiBody {String} mentorId id of the mentor to delete
 * @apiParamExample {json} Example Request:
 * { "mentorId": "Jojos" }
 *
 * @apiSuccess (200: Success) {String} success Indicates successful deletion of the mentor's office hours.
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 *   "Success"
 *
 * @apiError (400: Invalid Request) {String} InvalidRequest
 * @apiErrorExample Example Error Response (InvalidRequest):
 *     HTTP/1.1 400 Invalid Request
 *     {"error": "InvalidRequest"}
 *
 * @apiError (403: Invalid Permission) {String} InvalidPermission Caller has invalid permissions.
 * @apiErrorExample Example Error Response (InvalidPermission):
 *     HTTP/1.1 403 Invalid Permission
 *     {"error": "InvalidPermission"}
 */
mentorRouter.delete("/", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const mentorId: string | undefined = req.body.mentorId;
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    if (!mentorId) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "InvalidRequest"));
    }

    if (!hasElevatedPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "InvalidPermission"));
    }

    const officeHours: OfficeHoursFormat | null = await Models.MentorOfficeHours.findOne({ mentorId: mentorId });

    if (!officeHours) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "MentorNotFound"));
    }

    await Models.MentorOfficeHours.findOneAndDelete({ mentorId: mentorId });

    return res.status(StatusCode.SuccessOK).send("Success");
});

/**
 * @api {post} /mentor/attendance POST /mentor/attendance
 * @apiGroup Mentor
 * @apiDescription Checks an attendee into a mentor's office hours.
 *
 * @apiBody {String} mentorId id of the mentor to delete
 * @apiParamExample {json} Example Request:
 * { "mentorId": "Jojos" }
 *
 *
 * @apiSuccess (200: Success) {String} success Indicates successful checkin.
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 *   "Success"
 *
 * @apiError (400: Invalid Request) {String} InvalidRequest
 * @apiErrorExample Example Error Response (InvalidRequest):
 *     HTTP/1.1 400 Invalid Request
 *     {"error": "InvalidRequest"}
 *
 * @apiError (403: Invalid Permission) {String} InvalidPermission Caller has invalid permissions.
 * @apiErrorExample Example Error Response (InvalidPermission):
 *     HTTP/1.1 403 Invalid Permission
 *     {"error": "InvalidPermission"}
 *
 * @apiError (400: Invalid Request) {String} MentorNotFound
 * @apiErrorExample Example Error Response (InvalidPermission):
 *     HTTP/1.1 403 Invalid Request
 *     {"error": "MentorNotFound"}
 *
 * @apiError (400: Invalid Request) {String} AlreadyCheckedIn
 * @apiErrorExample Example Error Response (InvalidPermission):
 *     HTTP/1.1 403 Invalid Request
 *     {"error": "AlreadyCheckedIn"}
 */
mentorRouter.post("/attendance/", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const mentorId: string | undefined = req.body.mentorId;
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    if (!mentorId) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "InvalidRequest"));
    }
    // Checks that the caller is an attendee
    if (hasElevatedPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "InvalidPermission"));
    }

    const officeHours: OfficeHoursFormat | null = await Models.MentorOfficeHours.findOne({ mentorId: mentorId });

    if (!officeHours) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "MentorNotFound"));
    }

    // Checks whether the attendee has already checked in for the office hours
    if (officeHours.attendees.includes(payload.id)) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "AlreadyCheckedIn"));
    }

    await updatePoints(payload.id, pointCoinUpdateValue);
    await updateCoins(payload.id, pointCoinUpdateValue);

    await Models.MentorOfficeHours.findOneAndUpdate(
        { mentorId: mentorId },
        { $addToSet: { attendees: payload.id } },
        { new: true },
    );

    return res.status(StatusCode.SuccessOK).send("Success");
});

export default mentorRouter;
