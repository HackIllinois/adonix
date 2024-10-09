import { Router, Request, Response } from "express";
import { StatusCode } from "status-code-enum";

import { strongJwtVerification } from "../../middleware/verify-jwt";

import { JwtPayload } from "../auth/auth-models";
import { generateJwtToken, getJwtPayloadFromDB, hasElevatedPerms, hasStaffPerms } from "../auth/auth-lib";
import { performCheckIn } from "../staff/staff-lib";

import { UserInfo } from "../../database/user-db";
import Models from "../../database/models";
import Config from "../../common/config";
import { NextFunction } from "express-serve-static-core";
import { RouterError } from "../../middleware/error-handler";

const userRouter = Router();

/**
 * @api {get} /user/qr/ GET /user/qr/
 * @apiGroup User
 * @apiDescription Get a QR code with a pre-defined expiration for the user provided in the JWT token. Since expiry is set to 20 seconds,
 * we recommend that the results from this endpoint are not stored, but instead used immediately.
 * 
 * TODO: Rename back from /v2-qr/ to /qr/
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
userRouter.get("/v2-qr/", strongJwtVerification, (_: Request, res: Response) => {
    const payload = res.locals.payload as JwtPayload;
    const token = generateJwtToken(payload, false, Config.QR_EXPIRY_TIME);
    const uri = `hackillinois://user?userToken=${token}`;
    return res.status(StatusCode.SuccessOK).send({ userId: payload.id, qrInfo: uri });
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
    const targetUser = req.params.USERID as string;

    const payload = res.locals.payload as JwtPayload;
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
    const uri = `hackillinois://user?userToken=${token}`;
    return res.status(StatusCode.SuccessOK).send({ userId: newPayload.id, qrInfo: uri });
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
    const payload = res.locals.payload as JwtPayload;

    const user = await Models.UserInfo.findOne({ userId: payload.id });

    if (user) {
        return res.status(StatusCode.SuccessOK).send(user);
    }

    return next(new RouterError(StatusCode.ClientErrorNotFound, "UserNotFound"));
});

/**
 * @api {get} /user/following/ GET /user/following/
 * @apiGroup User
 * @apiDescription Get events that the given user is following
 *
 * @apiHeader {String} Authorization User's JWT Token
 * @apiSuccess (200: Success) {String} userId ID of the user
 * @apiSuccess (200: Success) {String[]} following Events that the user is following AFTER the operation is performed.
 * @apiSuccessExample {json} Example Success:
 *	{
 		"userId": "provider00001",
 		"following": ["event1", "event2", "event3"]
 * 	}
 * @apiUse strongVerifyErrors
*/
userRouter.get("/following/", strongJwtVerification, async (_: Request, res: Response) => {
    const payload = res.locals.payload as JwtPayload;

    const following = await Models.AttendeeFollowing.findOne({ userId: payload.id });
    return res.status(StatusCode.SuccessOK).send({ userId: payload.id, events: following?.following });
});

/**
 * @api {put} /user/follow/ PUT /user/follow/
 * @apiGroup User
 * @apiDescription Used by a user to follow an event. UserID is taken from the JWT token passed in.
 * @apiBody {String} eventId The id of the event to follow.
 * @apiParamExample {json} Request Example:
 *     {
 *       "eventId": "exampleEventId"
 *     }
 * @apiSuccess (200: Success) {String} userId ID of the user
 * @apiSuccess (200: Success) {String[]} following Events that the user is following AFTER the operation is performed.
 * @apiSuccessExample {json} Success Response:
 *	{
		"userId": "provider00001",
		"following": ["event1", "event2", "event3"]
 * 	}
 * @apiUse strongVerifyErrors
 * @apiError (404: Bad Request) {String} UserNotFound User with userId not found.
 * @apiError (404: Bad Request) {String} EventNotFound Event with eventId not found.
 */
userRouter.put("/follow/", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const payload = res.locals.payload as JwtPayload;
    const eventId = req.body.eventId;

    if (!eventId) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "InvalidEventId"));
    }

    const eventExists = await Models.EventFollowers.findOneAndUpdate(
        { eventId: eventId },
        { $addToSet: { followers: payload.id } },
        { new: true, upsert: true },
    );

    if (!eventExists) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "EventNotFound"));
    }

    const attendeeFollowing = await Models.AttendeeFollowing.findOneAndUpdate(
        { userId: payload.id },
        { $addToSet: { following: eventId } },
        { new: true, upsert: true },
    );

    if (!attendeeFollowing) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "UserNotFound"));
    }

    return res.status(StatusCode.SuccessOK).send({ userId: attendeeFollowing.userId, following: attendeeFollowing.following });
});

/**
 * @api {put} /user/unfollow/ PUT /user/unfollow/
 * @apiGroup User
 * @apiDescription Used by a user to unfollow an event. UserID is taken from the JWT token passed in.
 *
 * @apiBody {String} eventId The unique identifier of the event to unfollow.
 * @apiParamExample {json} Request-Example:
 *     {
 *       "eventId": "exampleEventId"
 *     }
 * @apiSuccess (200: Success) {String} userId ID of the user
 * @apiSuccess (200: Success) {String[]} following Events that the user is following AFTER the operation is performed.
 * @apiSuccessExample {json} Success Example:
 *	{
		"userId": "provider00001",
		"following": ["event1", "event2", "event3"]
 * 	}
 *
 * @apiUse strongVerifyErrors
 * @apiError (404: Bad Request) {String} UserNotFound User with userId not found.
 * @apiError (404: Bad Request) {String} EventNotFound Event with eventId not found.
 */
userRouter.put("/unfollow/", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const payload = res.locals.payload as JwtPayload;
    const eventId = req.body.eventId;

    // eventID has to exist
    const eventFollowers = await Models.EventFollowers.findOneAndUpdate(
        { eventId: eventId },
        { $pull: { followers: payload.id } },
        { new: true },
    );

    if (!eventFollowers) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "EventNotFound"));
    }

    const attendeeFollowing = await Models.AttendeeFollowing.findOneAndUpdate(
        { userId: payload.id },
        { $pull: { following: eventId } },
        { new: true },
    );

    if (!attendeeFollowing) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "UserNotFound"));
    }

    return res.status(StatusCode.SuccessOK).send({ userId: attendeeFollowing.userId, following: attendeeFollowing.following });
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
    const targetUser = req.params.USERID as string;

    // Get payload, and check if authorized
    const payload = res.locals.payload as JwtPayload;
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
 * @api {put} /user/scan-event/ PUT /user/scan-event/
 * @apiGroup User
 * @apiDescription Record user attendance for a self check-in event.
 *
 * @apiBody {String} eventId The unique identifier of the event.
 *
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 * {success: true}
 *
 * @apiUse strongVerifyErrors
 * @apiError (400: Bad Request) {String} InvalidParams Invalid or missing parameters.
 * @apiError (400: Bad Request) {String} AlreadyCheckedIn Attendee has already been checked in for this event.
 * @apiError (404: Not Found) {String} EventNotFound This event was not found
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 400 Bad Request
 *     {"error": "InvalidParams"}
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 400 Bad Request
 *     {"error": "AlreadyCheckedIn"}
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 404 Not Found
 *     {"error": "EventNotFound"}
 */
userRouter.put("/scan-event/", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const payload = res.locals.payload as JwtPayload;
    const userId = payload.id;
    const eventId = req.body.eventId as string | undefined;

    if (!eventId) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "InvalidParams"));
    }

    const eventData = await Models.Event.findOne({ eventId: eventId });
    if (!eventData) {
        return next(new RouterError(StatusCode.ClientErrorFailedDependency, "NonexistentEvent"));
    }

    const result = await performCheckIn(eventId, userId, eventData.points);

    if (!result.success) {
        return next(result.error);
    }

    return res.status(StatusCode.SuccessOK).json({ success: true, points: eventData.points });
});

export default userRouter;
