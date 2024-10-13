import cors from "cors";
import { Request, Router } from "express";
import { NextFunction, Response } from "express-serve-static-core";

import Config, { Avatars } from "../../common/config";
import { AttendeeProfile } from "../../database/attendee-db";
import { RegistrationApplication } from "../../database/registration-db";
import { isValidLimit, updatePointsAndCoins } from "./profile-lib";

import { Query } from "mongoose";
import Models from "../../database/models";
import { LeaderboardEntry } from "./profile-models";

import { StatusCode } from "status-code-enum";
import { strongJwtVerification } from "../../middleware/verify-jwt";
import { hasElevatedPerms } from "../../common/auth";
import { JwtPayload } from "../auth/auth-schemas";

import { isNumber } from "../../common/formatTools";
import { RouterError } from "../../middleware/error-handler";
import { isValidProfileFormat } from "./profile-formats";

const profileRouter = Router();

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
    const limitString = req.query.limit as string | undefined;

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
    const filteredLeaderboardEntried: LeaderboardEntry[] = leaderboardProfiles.map((profile) => ({
        displayName: profile.displayName,
        points: profile.points,
    }));

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
    const payload = res.locals.payload as JwtPayload;

    const userId = payload.id;

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
    const userId = req.params.USERID as string | undefined;
    const payload = res.locals.payload as JwtPayload;

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

profileRouter.get("/id", (_: Request, res: Response) =>
    // Redirect to the root URL
    res.redirect("/user"),
);

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
 * @apiSuccess (200: Success) {string} avatarUrl URL that contains the user selected avatar. If invalid avatar is passed, default avatar is assigned.
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
 *    "avatarUrl": "https://hackillinois.org/mushroom.png",
 *    "points": 0,
 *    "coins": 0
 * }
 *
 * @apiError (400: Bad Request) {String} UserAlreadyExists The user profile already exists.
 * @apiError (500: Internal Error) {String} InternalError An internal server error occurred.
 * @apiErrorExample Example Error Response (UserAlreadyExists):
 *     HTTP/1.1 400 Bad Request
 *     {"error": "UserAlreadyExists"}
 *
 */
profileRouter.post("/", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const avatarId: string = (Object.values(Avatars) as string[]).includes(req.body.avatarId as string)
        ? (req.body.avatarId as string)
        : Config.DEFAULT_AVATAR;

    const profile = req.body as AttendeeProfile;
    profile.points = Config.DEFAULT_POINT_VALUE;
    profile.coins = Config.DEFAULT_COIN_VALUE;
    profile.avatarUrl = `https://raw.githubusercontent.com/HackIllinois/adonix-metadata/main/avatars/${avatarId}.png`;
    console.log(profile.avatarUrl);

    const payload = res.locals.payload as JwtPayload;
    profile.userId = payload.id;

    const registrationApplication: RegistrationApplication | null = await Models.RegistrationApplication.findOne({
        userId: profile.userId,
    });
    if (registrationApplication) {
        const dietaryRestrictions: string[] = registrationApplication.dietaryRestrictions;
        if (dietaryRestrictions.length == 0 || dietaryRestrictions[0] == "None") {
            profile.foodWave = 2;
        } else {
            profile.foodWave = 1;
        }
    }

    if (!isValidProfileFormat(profile)) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "InvalidParams"));
    }

    // Ensure that user doesn't already exist before creating
    const user: AttendeeProfile | null = await Models.AttendeeProfile.findOne({ userId: profile.userId });
    if (user) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "UserAlreadyExists"));
    }

    // Create a metadata object, and return it
    try {
        const newProfile = await Models.AttendeeProfile.create(profile);
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
    const decodedData = res.locals.payload as JwtPayload;

    const attendeeProfileDeleteResponse = await Models.AttendeeProfile.deleteOne({ userId: decodedData.id });

    if (attendeeProfileDeleteResponse.deletedCount == 0) {
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
    const points = req.body.points as number;
    const userId = req.body.userId as string;

    const payload = res.locals.payload as JwtPayload;

    if (!isNumber(points)) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "NoPoints"));
    }

    //Sends error if caller doesn't have elevated perms
    if (!hasElevatedPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "Forbidden"));
    }

    const queryResult: AttendeeProfile | null = await Models.AttendeeProfile.findOne({ userId: userId });

    if (!queryResult) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "UserNotFound"));
    }

    await updatePointsAndCoins(userId, points);

    const updatedProfile: AttendeeProfile | null = await Models.AttendeeProfile.findOne({ userId: userId });

    return res.status(StatusCode.SuccessOK).send(updatedProfile);
});

/**
 * @api {get} /profile/ranking/ GET /profile/ranking/
 * @apiGroup Profile
 * @apiDescription Get the ranking of a user based on their authentication. If users are tied in points, ranking is assigned in alphabetical order.
 *
 * @apiSuccess (200: Success) {number} ranking Ranking of the user
 *
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 * {
 *    "ranking": 1
 * }
 *
 * @apiError (404: Not Found) {String} UserNotFound The user's profile was not found.
 * @apiError (500: Internal) {String} InternalError An internal server error occured.
 */
profileRouter.get("/ranking/", strongJwtVerification, async (_: Request, res: Response, next: NextFunction) => {
    const payload = res.locals.payload as JwtPayload;
    const userId = payload.id;

    const sortedUsers = await Models.AttendeeProfile.find().sort({ points: -1, userId: 1 });
    const userIndex = sortedUsers.findIndex((u) => u.userId == userId);

    if (userIndex < 0) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "ProfileNotFound"));
    }

    const userRanking = userIndex + Config.RANKING_OFFSET;

    return res.status(StatusCode.SuccessOK).send({ ranking: userRanking });
});

export default profileRouter;
