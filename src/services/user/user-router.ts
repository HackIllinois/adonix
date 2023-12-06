import { Router, Request, Response } from "express";
import { StatusCode } from "status-code-enum";

import { strongJwtVerification } from "../../middleware/verify-jwt.js";

import { JwtPayload } from "../auth/auth-models.js";
import { generateJwtToken, getJwtPayloadFromDB, hasElevatedPerms, hasStaffPerms } from "../auth/auth-lib.js";

import { UserInfo } from "../../database/user-db.js";
import Models from "../../database/models.js";
import Config from "../../config.js";
import { AttendeeFollowing } from "database/attendee-db.js";
import { NextFunction } from "express-serve-static-core";
import { RouterError } from "../../middleware/error-handler.js";
const userRouter: Router = Router();

/**
 * @api {get} /user/qr/ GET /user/qr/
 * @apiGroup User
 * @apiDescription Get a QR code with a pre-defined expiration for the user provided in the JWT token. Since expiry is set to 20 seconds,
 * we recommend that the results from this endpoint are not stored, but instead used immediately.
 *
 * @apiSuccess (200: Success) {String} userId User to generate a QR code for
 * @apiSuccess (200: Success) {String} qrInfo Stringified QR code for the given user

 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
 *		"userId": "provider000001",
 * 		"qrinfo": "hackillinois://user?userToken=loremipsumdolorsitamet"
 * 	}
 *
 * @apiUse strongVerifyErrors
 */
userRouter.get("/qr/", strongJwtVerification, (_: Request, res: Response) => {
    // Return the same payload, but with a shorter expiration time
    const payload: JwtPayload = res.locals.payload as JwtPayload;
    const token: string = generateJwtToken(payload, false, Config.QR_EXPIRY_TIME);
    const uri: string = `hackillinois://user?userToken=${token}`;
    res.status(StatusCode.SuccessOK).send({ userId: payload.id, qrInfo: uri });
});

/**
 * @api {get} /user/qr/:USERID/ GET /user/qr/:USERID/
 * @apiGroup User
 * @apiDescription Get a QR code with a pre-defined expiration for a particular user, provided that the JWT token's user has elevated perms. Since expiry is set to 20 seconds,
 * we recommend that the results from this endpoint are not stored, but instead used immediately.
 *
 * @apiParam {String} USERID Id to generate the QR code for.
 *
 * @apiSuccess (200: Success) {String} userId User to generate a QR code for
 * @apiSuccess (200: Success) {String} qrInfo Stringified QR code for the user to be used

 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
 *		"userId": "provider000001",
 * 		"qrinfo": "hackillinois://user?userToken=loremipsumdolorsitamet"
 * 	}
 *
 * @apiError (400: Bad Request) {String} UserNotFound User doesn't exist in the database.
 * @apiError (403: Forbidden) {String} Forbidden API access by user (no valid perms).
 * @apiUse strongVerifyErrors
 */
userRouter.get("/qr/:USERID", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const targetUser: string | undefined = req.params.USERID as string;

    const payload: JwtPayload = res.locals.payload as JwtPayload;
    let newPayload: JwtPayload | undefined;

    // Check if target user -> if so, return same payload but modified expiry
    // Check if elevated -> if so, generate a new payload and return that one
    if (payload.id == targetUser) {
        newPayload = payload;
    } else if (hasStaffPerms(payload)) {
        newPayload = await getJwtPayloadFromDB(targetUser);
    }

    // Return false if we haven't created a payload yet
    if (!newPayload) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "Forbidden"));
    }

    // Generate the token
    const token: string = generateJwtToken(newPayload, false, "20s");
    const uri: string = `hackillinois://user?userToken=${token}`;
    return res.status(StatusCode.SuccessOK).send({ userId: newPayload.id, qrInfo: uri });
});

/**
 * @api {get} /user/:USERID/ GET /user/:USERID/
 * @apiGroup User
 * @apiDescription Get user data for a particular user, provided that the JWT token's user has elevated perms.
 * @apiParam {String} USERID to generate the QR code for.
 *
 * @apiSuccess (200: Success) {String} userId UserID
 * @apiSuccess (200: Success) {String} name User's name.
 * @apiSuccess (200: Success) {String} email Email address (staff gmail or Github email).

 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
		"userId": "provider00001",
		"name": "john doe",
		"email": "johndoe@provider.com"
 * 	}
 *
 * @apiError (400: Bad Request) {String} UserNotFound User doesn't exist in the database.
 * @apiError (403: Forbidden) {String} Forbidden API access by user (no valid perms).
 * @apiUse strongVerifyErrors
 */
userRouter.get("/:USERID", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const targetUser: string = req.params.USERID ?? "";

    // Get payload, and check if authorized
    const payload: JwtPayload = res.locals.payload as JwtPayload;
    if (payload.id == targetUser || hasElevatedPerms(payload)) {
        // Authorized -> return the user object
        const userInfo: UserInfo | null = await Models.UserInfo.findOne({ userId: targetUser });
        if (userInfo) {
            return res.status(StatusCode.SuccessOK).send(userInfo);
        } else {
            return next(new RouterError(StatusCode.ClientErrorNotFound, "UserNotFound"));
        }
    }

    return next(new RouterError(StatusCode.ClientErrorForbidden, "Forbidden"));
});

/**
 * @api {get} /user/ GET /user/
 * @apiGroup User
 * @apiDescription Get user data for the current user in the JWT token.
 *
 * @apiSuccess (200: Success) {String} userId UserID
 * @apiSuccess (200: Success) {String} name User's name.
 * @apiSuccess (200: Success) {String} email Email address (staff gmail or Github email).

 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
		"userId": "provider00001",
		"name": "john doe",
		"email": "johndoe@provider.com"
 * 	}
 *
 * @apiUse strongVerifyErrors
 */
userRouter.get("/", strongJwtVerification, async (_: Request, res: Response, next: NextFunction) => {
    // Get payload, return user's values
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    const user: UserInfo | null = await Models.UserInfo.findOne({ userId: payload.id });

    if (user) {
        return res.status(StatusCode.SuccessOK).send(user);
    } else {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "UserNotFound"));
    }
});

/**
 * @api {get} /user/following/:USERID/ GET /user/following/:USERID/
 * @apiGroup User
 * @apiDescription Get events that a user is following for a specific user by its unique ID.
 *
 * @apiHeader {String} Authorization User's JWT Token with staff permissions.
 *
 * @apiParam {String} USERID The unique identifier of the user.
 *
 * @apiSuccess (200: Success) {JSON} events The events a user is following.
 * @apiSuccessExample Example Success Response
 * HTTP/1.1 200 OK
 * [
 *  "event1",
 *  "event2",
 *  "event3"
 * ]
 * @apiUse strongVerifyErrors
 * @apiError (400: Bad Request) {String} UserNotFound User with the given ID not found.
 * @apiError (403: Forbidden) {String} InvalidPermission User does not have staff permissions.
 */
userRouter.get("/following/:USERID", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;
    if (!hasStaffPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "Forbidden"));
    }
    const userId: string | undefined = req.params.USERID;
    const events: AttendeeFollowing | null = await Models.AttendeeFollowing.findOne({ userId: userId });
    if (!events) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "UserNotFound"));
    }
    return res.status(StatusCode.SuccessOK).send(events.events);
});

/**
 * @api {put} /user/follow/:EVENTID/ GET /user/follow/:EVENTID/
 * @apiGroup User
 * @apiDescription Enables a user to follow/favorite an event.
 *
 * @apiParam {String} EVENTID The unique identifier of the event to follow.
 *
 * @apiSuccess (200: Success) {String} StatusSuccess.
 *
 * @apiUse strongVerifyErrors
 * @apiError (400: Bad Request) {String} UserNotFound User with userId not found.
 * @apiError (400: Bad Request) {String} EventNotFound User with EVENTID not found.
 */
userRouter.put("/follow/:EVENTID", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;
    const eventId: string | undefined = req.params.EVENTID;
    if (!eventId) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "InvalidEventId"));
    }
    try {
        const followers = await Models.EventFollowers.findOneAndUpdate(
            { eventId: eventId },
            { $addToSet: { followers: payload.id } },
            { new: true },
        );
        if (!followers) {
            return next(new RouterError(StatusCode.ClientErrorNotFound, "EventNotFound"));
        }
        const events = await Models.AttendeeFollowing.findOneAndUpdate(
            { userId: payload.id },
            { $addToSet: { events: eventId } },
            { new: true },
        );
        if (!events) {
            return next(new RouterError(StatusCode.ClientErrorNotFound, "UserNotFound"));
        }
        return res.status(StatusCode.SuccessOK).send({ message: "StatusSuccess" });
    } catch {
        return next(new RouterError(StatusCode.ServerErrorInternal, "InternalError"));
    }
});

/**
 * @api {put} /user/unfollow/:EVENTID/ GET /user/unfollow/:EVENTID/
 * @apiGroup User
 * @apiDescription Enables a user to unfollow/unfavorite an event.
 *
 * @apiParam {String} EVENTID The unique identifier of the event to unfollow.
 *
 * @apiSuccess (200: Success) {String} StatusSuccess.
 *
 * @apiUse strongVerifyErrors
 * @apiError (400: Bad Request) {String} UserNotFound User with userId not found.
 * @apiError (400: Bad Request) {String} EventNotFound User with EVENTID not found.
 */
userRouter.put("/unfollow/:EVENTID", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;
    const eventId: string | undefined = req.params.EVENTID;
    try {
        const followers = await Models.EventFollowers.findOneAndUpdate(
            { eventId: eventId },
            { $pull: { followers: payload.id } },
            { new: true },
        );
        if (!followers) {
            return next(new RouterError(StatusCode.ClientErrorNotFound, "EventNotFound"));
        }
        const events = await Models.AttendeeFollowing.findOneAndUpdate(
            { userId: payload.id },
            { $pull: { events: eventId } },
            { new: true },
        );
        if (!events) {
            return next(new RouterError(StatusCode.ClientErrorNotFound, "UserNotFound"));
        }
        return res.status(StatusCode.SuccessOK).send({ message: "StatusSuccess" });
    } catch (error) {
        return next(new RouterError(StatusCode.ServerErrorInternal, "InternalError"));
    }
});

export default userRouter;
