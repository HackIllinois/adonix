import cors from "cors";
import { Request, Router } from "express";
import { NextFunction, Response } from "express-serve-static-core";

import Config from "../../config.js";
import { isValidLimit, updatePoints, updateCoins } from "./profile-lib.js";
import { AttendeeMetadata, AttendeeProfile } from "../../database/attendee-db.js";
import Models from "../../database/models.js";
import { Query } from "mongoose";
import { LeaderboardEntry } from "./profile-models.js";

import { JwtPayload } from "../auth/auth-models.js";
import { strongJwtVerification } from "../../middleware/verify-jwt.js";
import { ProfilePreFormat, ProfileFormat, isValidProfileFormat } from "./profile-formats.js";
import { hasElevatedPerms } from "../auth/auth-lib.js";
import { DeleteResult } from "mongodb";
import { StatusCode } from "status-code-enum";

import { RouterError } from "../../middleware/error-handler.js";

const profileRouter: Router = Router();

profileRouter.use(cors({ origin: "*" }));

/**
 * @api {get} /profile/leaderboard/ GET /profile/leaderboard/
 * @apiGroup Profile
 * @apiDescription Get the top N profiles from the leaderboard, sorted by points.
 *
 * @apiQuery {int} limit Number of profiles to return. If not provided, defaults to all profiles stored in the database.
 *
 * @apiSuccess (200: Success) {Json} profiles Specified number of profiles, sorted in descending point order.
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 * {
    "profiles": [
        {
            "displayName": "profileid123456",
            "points": 2021,
        },
        {
            "displayName": "patrick"
            "points": 2020,
        },
    ]
 }

 * @apiError (400: Bad Request) {String} InvalidInput Invalid value passed in for limit (negative or zero).
 * @apiError (500: Internal Error) {String} InternalError Database operation failed.
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 400 Bad Request
 *     {"error": "InvalidInput"}
 */
profileRouter.get("/leaderboard/", async (req: Request, res: Response, next: NextFunction) => {
    const limitString: string | undefined = req.query.limit as string | undefined;

    // Initialize the metadata
    let leaderboardQuery: Query<AttendeeProfile[], AttendeeProfile> = Models.AttendeeProfile.find().sort({ points: -1 });

    // Returns NaN if invalid input is passed in
    if (limitString) {
        let limit = parseInt(limitString);

        // Check for limit validity
        if (!limit || !isValidLimit) {
            return next(new RouterError(StatusCode.ClientErrorBadRequest, "InvalidLimit"));
        }

        // if the limit is above the leaderboard query limit, set it to the query limit
        limit = Math.min(limit, Config.LEADERBOARD_QUERY_LIMIT);

        leaderboardQuery = leaderboardQuery.limit(limit);
    } else {
        const limit = Config.LEADERBOARD_QUERY_LIMIT;

        leaderboardQuery = leaderboardQuery.limit(limit);
    }
    // Perform the actual query, filter, and return the results
    const leaderboardProfiles: AttendeeProfile[] = await leaderboardQuery;
    const filteredLeaderboardEntried: LeaderboardEntry[] = leaderboardProfiles.map((profile) => {
        return { displayName: profile.displayName, points: profile.points };
    });

    return res.status(StatusCode.SuccessOK).send({
        profiles: filteredLeaderboardEntried,
    });
});

/**
 * @api {get} /profile/ GET /profile/
 * @apiGroup Profile
 * @apiDescription Retrieve the user profile based on their authentication.
 *
 * @apiSuccess (200: Success) {string} userID ID of the user
 * @apiSuccess (200: Success) {string} displayName Publicly-visible display name for the user
 * @apiSuccess (200: Success) {string} discordTag Discord tag for the user
 * @apiSuccess (200: Success) {string} avatarUrl URL that contains the user's selected avatar
 * @apiSuccess (200: Success) {number} points Points that the user has
 * @apiSuccess (200: Success) {number} coins Coins that the user has
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 * {
 *    "_id": "12345",
 *    "userId": "google12345"
 *    "displayName": "hackillinois",
 *    "discordTag": "discordtag",
 *    "avatarUrl": "na",
 *    "points": 0,
 *    "coins": 10
 * }
 *
 * @apiError (404: Not Found) {String} UserNotFound The user's profile was not found.
 * @apiError (500: Internal Error) {String} InternalError An internal server error occurred.
 * @apiErrorExample Example Error Response (UserNotFound):
 *     HTTP/1.1 404 Not Found
 *     {"error": "UserNotFound"}
 *
 * @apiErrorExample Example Error Response (InternalError):
 *     HTTP/1.1 500 Internal Server Error
 *     {"error": "InternalError"}
 */

profileRouter.get("/", strongJwtVerification, async (_: Request, res: Response, next: NextFunction) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    const userId: string = payload.id;

    const user: AttendeeProfile | null = await Models.AttendeeProfile.findOne({ userId: userId });

    if (!user) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "UserNotFound"));
    }

    return res.status(StatusCode.SuccessOK).send(user);
});

/**
 * @api {get} /profile/userid/:USERID GET /profile/userid/:USERID
 * @apiGroup Profile
 * @apiDescription Retrieve the user's profile based on the provided ID as a path parameter.
 *
 * @apiParam {String} USERID User's unique ID.
 *
 * @apiSuccess (200: Success) {string} userID ID of the user
 * @apiSuccess (200: Success) {string} displayName Publicly-visible display name for the user
 * @apiSuccess (200: Success) {string} discordTag Discord tag for the user
 * @apiSuccess (200: Success) {string} avatarUrl URL that contains the user's selected avatar
 * @apiSuccess (200: Success) {number} points Points that the user has
 * @apiSuccess (200: Success) {number} coins Coins that the user has
 *
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 * {
 *    "_id": "12345",
 *    "userId": "google12345",
 *    "displayName": "Hack",
 *    "discordTag": "hackillinois",
 *    "avatarUrl": "na",
 *    "points": 0,
 *    "coins": 10
 * }
 *
 * @apiError (404: Not Found) {String} UserNotFound The user's profile was not found.
 * @apiError (500: Internal Error) {String} InternalError An internal server error occurred.
 * @apiErrorExample Example Error Response (UserNotFound):
 *     HTTP/1.1 404 Not Found
 *     {"error": "UserNotFound"}
 *
 * @apiErrorExample Example Error Response (InternalError):
 *     HTTP/1.1 500 Internal Server Error
 *     {"error": "InternalError"}
 */

profileRouter.get("/userid/:USERID", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const userId: string | undefined = req.params.USERID;
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    // Trying to perform elevated operation (getting someone else's profile without elevated perms)
    if (!hasElevatedPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "Forbidden"));
    }

    const user: AttendeeProfile | null = await Models.AttendeeProfile.findOne({ userId: userId });

    if (!user) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "UserNotFound"));
    }

    return res.status(StatusCode.SuccessOK).send(user);
});

profileRouter.get("/id", (_: Request, res: Response) => {
    // Redirect to the root URL
    return res.redirect("/user");
});

/**
 * @api {post} /profile POST /profile
 * @apiGroup Profile
 * @apiDescription Create a user profile based on their authentication.
 *
 * @apiBody {String} displayName User's displayName.
 * @apiBody {String} discordTag User's Discord username.
 * @apiBody {String} avatarId User's requested avatar.
 *
 * @apiSuccess (200: Success) {string} userID ID of the user
 * @apiSuccess (200: Success) {string} displayName Publicly-visible display name for the user
 * @apiSuccess (200: Success) {string} discordTag Discord tag for the user
 * @apiSuccess (200: Success) {string} avatarUrl URL that contains the user selected avatar
 * @apiSuccess (200: Success) {number} points Points that the user has
 * @apiSuccess (200: Success) {number} coins Coins that the user has
 *
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 * {
 *    "_id": "abc12345",
 *    "userId": "github12345",
 *    "displayName": "Hack",
 *    "discordTag": "HackIllinois",
 *    "avatarUrl": "mushroom.png",
 *    "points": 0,
 *    "coins": 0
 * }
 *
 * @apiError (400: Bad Request) {String} UserAlreadyExists The user profile already exists.
 * @apiError (400: Bad Request) {String} BadAvatar Avatar is not recognized by API.
 * @apiError (500: Internal Error) {String} InternalError An internal server error occurred.
 * @apiErrorExample Example Error Response (UserAlreadyExists):
 *     HTTP/1.1 400 Bad Request
 *     {"error": "UserAlreadyExists"}
 *
 */
profileRouter.post("/", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const preProfile: ProfilePreFormat = req.body as ProfilePreFormat;
    preProfile.points = Config.DEFAULT_POINT_VALUE;
    preProfile.coins = Config.DEFAULT_COIN_VALUE;

    const payload: JwtPayload = res.locals.payload as JwtPayload;
    preProfile.userId = payload.id;

    if (!isValidProfileFormat(preProfile)) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "InvalidParams"));
    }

    // Ensure that user doesn't already exist before creating
    const user: AttendeeProfile | null = await Models.AttendeeProfile.findOne({ userId: preProfile.userId });
    if (user) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "UserAlreadyExists"));
    }

    if (!Config.AVATAR_URLS.has(preProfile.avatarId)) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "BadAvatar"));
    }

    // Create a metadata object, and return it
    try {
        const profile: ProfileFormat = {
            userId: preProfile.userId,
            avatarUrl: Config.AVATAR_URLS.get(preProfile.avatarId) || Config.DEFAULT_AVATAR,
            discordTag: preProfile.discordTag,
            displayName: preProfile.displayName,
            points: preProfile.points,
            coins: preProfile.coins,
        };
        const profileMetadata: AttendeeMetadata = new AttendeeMetadata(profile.userId, Config.DEFAULT_FOOD_WAVE);
        const newProfile = await Models.AttendeeProfile.create(profile);
        await Models.AttendeeMetadata.create(profileMetadata);
        return res.status(StatusCode.SuccessOK).send(newProfile);
    } catch (error) {
        console.error(error);
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "InvalidParams"));
    }
});

/**
 * @api {delete} /profile DELETE /profile
 * @apiGroup Profile
 * @apiDescription Delete the user's profile based on their authentication.
 *
 * @apiSuccess (200: Success) {Json} success Indicates successful deletion of the user's profile.
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 * {
 *    "success": true
 * }
 *
 * @apiError (500: Internal Error) {String} InternalError An internal server error occurred.
 * @apiErrorExample Example Error Response (InternalError):
 *     HTTP/1.1 500 Internal Server Error
 *     {"error": "InternalError"}
 */

profileRouter.delete("/", strongJwtVerification, async (_: Request, res: Response, next: NextFunction) => {
    const decodedData: JwtPayload = res.locals.payload as JwtPayload;

    const attendeeProfileDeleteResponse: DeleteResult = await Models.AttendeeProfile.deleteOne({ userId: decodedData.id });
    const attendeeMetadataDeleteResponse: DeleteResult = await Models.AttendeeMetadata.deleteOne({ userId: decodedData.id });

    if (attendeeMetadataDeleteResponse.deletedCount == 0 || attendeeProfileDeleteResponse.deletedCount == 0) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "AttendeeNotFound"));
    }
    return res.status(StatusCode.SuccessOK).send({ success: true });
});

/**
 * @api {post} /profile/addpoints/ POST /profile/addpoints/
 * @apiGroup Profile
 * @apiDescription Add points to the specified user, given that the currently authenticated user has elevated perms. Note: If points are increasing, coins will also increase the same amount. If points are being decreased, coins remain unchanged.
 *
 * @apiBody {String} userId User to add points to.
 * @apiBody {int} points Number of points to add.
 *
 * @apiSuccess (200: Success) {string} userID ID of the user
 * @apiSuccess (200: Success) {string} displayName Publicly-visible display name for the user
 * @apiSuccess (200: Success) {string} discordTag Discord tag for the user
 * @apiSuccess (200: Success) {string} avatarUrl URL that contains the user's selected avatar
 * @apiSuccess (200: Success) {number} points Points that the user has
 * @apiSuccess (200: Success) {number} coins Coins that the user has
 *
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 * {
 *    "_id": "abc12345",
 *    "userId": "github12345",
 *    "displayName": "Hack",
 *    "discord": "HackIllinois",
 *    "avatarUrl": "na",
 *    "points": 10,
 *    "coins": 10
 * }
 *
 * @apiError (403: Forbidden) {String} Forbidden API accessed by user without valid perms.
 * @apiError (400: Forbidden) {String} User not found in database.
 */

profileRouter.post("/addpoints", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const points: number = req.body.points;
    const userId: string = req.body.userId;

    const payload: JwtPayload = res.locals.payload as JwtPayload;

    //Sends error if caller doesn't have elevated perms
    if (!hasElevatedPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "Forbidden"));
    }

    const queryResult: AttendeeProfile | null = await Models.AttendeeProfile.findOne({ userId: userId });

    if (!queryResult) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "UserNotFound"));
    }

    await updatePoints(userId, points);
    if (points > 0) {
        await updateCoins(userId, points);
    }

    const updatedProfile: AttendeeProfile | null = await Models.AttendeeProfile.findOne({ userId: userId });

    return res.status(StatusCode.SuccessOK).send(updatedProfile);
});

export default profileRouter;
