import cors from "cors";
import { Request, Router } from "express";
import { Response } from "express-serve-static-core";

import Constants from "../../constants.js";
import { isValidLimit } from "./profile-lib.js";
import { AttendeeMetadata, AttendeeMetadataModel, AttendeeProfile, AttendeeProfileModel } from "../../database/attendee-db.js";
import { Query, UpdateQuery } from "mongoose";
import { LeaderboardEntry } from "./profile-models.js";

import { JwtPayload } from "../auth/auth-models.js";
import { strongJwtVerification, weakJwtVerification } from "../../middleware/verify-jwt.js";
import { hasElevatedPerms } from "../auth/auth-lib.js";
import { isValidProfileModel } from "./profile-formats.js";

const profileRouter: Router = Router();

profileRouter.use(cors({ origin: "*" }));

/**
 * @api {get} /profile/leaderboard/ GET /profile/leaderboard/
 * @apiGroup Profile
 * @apiDescription Get the top N profiles from the leaderboard, sorted by points.
 *
 * @apiQuery {int} limit Number of profiles to return. If not provided, defaults to all profiles stored in the database.
 *
 *
 * @apiSuccess (200: Success) {Json} profiles Specified number of profiles, sorted in descending point order.
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 * {
    "profiles": [
        {
            "id": "profileid123456",
            "points": 2021,
            "discord": "patrick#1234"
        },
        {
            "id": "profileid123456",
            "points": 2021,
            "discord": "patrick#1234"
        },
    ]
 }

 * @apiError (400: Bad Request) {String} InvalidInput Invalid value passed in for limit (negative or zero).
 * @apiError (500: Internal Error) {String} InternalError Database operation failed.
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 400 Bad Request
 *     {"error": "InvalidInput"}
 */
profileRouter.get("/leaderboard/", async (req: Request, res: Response) => {
    const limitString: string | undefined = req.query.limit as string | undefined;

    // Initialize the metadata
    let leaderboardQuery: Query<AttendeeProfile[], AttendeeProfile> = AttendeeProfileModel.find().sort({ points: -1 });

    // Returns NaN if invalid input is passed in
    if (limitString) {
        const limit = parseInt(limitString);

        // Check for limit validity
        if (!limit || !isValidLimit) {
            return res.status(Constants.BAD_REQUEST).send({ error: "InvalidLimit" });
        }

        leaderboardQuery = leaderboardQuery.limit(limit);
    }
    // Perform the actual query, filter, and return the results
    const leaderboardProfiles: AttendeeProfile[] = await leaderboardQuery;
    const filteredLeaderboardEntried: LeaderboardEntry[] = leaderboardProfiles.map((profile) => {
        return { displayName: profile.displayName, points: profile.points };
    });

    return res.status(Constants.SUCCESS).send({
        profiles: filteredLeaderboardEntried,
    });
});

/**
 * @api {get} /profile/ GET /profile/
 * @apiGroup Profile
 * @apiDescription Retrieve the user profile based on their authentication.
 *
 * @apiSuccess (200: Success) {Json} user User's profile information.
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 * {
 *    "_id": "12345",
 *    "firstName": "Hackk",
 *    "lastName": "Illinois",
 *    "discord": "hackillinois",
 *    "avatarUrl": "na",
 *    "points": 0,
 *    "id": "abcde",
 *    "foodWave": 0
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

profileRouter.get("/", strongJwtVerification, async (_: Request, res: Response) => {
    const decodedData: JwtPayload = res.locals.payload as JwtPayload;

    const id: string = decodedData.id;
    const user: AttendeeProfile | null = await AttendeeProfileModel.findOne({ userId: id });

    if (!user) {
        return res.status(Constants.NOT_FOUND).send({ error: "UserNotFound" });
    }

    return res.status(Constants.SUCCESS).send(user);
});

/**
 * @api {get} /profile/userid/:USERID GET /profile/userid/:USERID
 * @apiGroup Profile
 * @apiDescription Retrieve the user's profile based on the provided ID as a path parameter.
 *
 * @apiParam {String} id User's unique ID.
 *
 * @apiSuccess (200: Success) {Json} user User's profile information.
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 * {
 *    "_id": "12345",
 *    "firstName": "Hackk",
 *    "lastName": "Illinois",
 *    "discord": "hackillinois",
 *    "avatarUrl": "na",
 *    "points": 0,
 *    "id": "abcde",
 *    "foodWave": 0
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

profileRouter.get("/id/:USERID", weakJwtVerification, async (req: Request, res: Response) => {
    const id: string | undefined = req.params.USERID;
    console.log(id);

    const user: AttendeeProfile | null = await AttendeeProfileModel.findOne({ userId: id });

    if (!user) {
        return res.status(Constants.NOT_FOUND).send({ error: "UserNotFound" });
    }

    return res.status(Constants.SUCCESS).send(user);
});

/**
 * @api {post} /profile POST /profile
 * @apiGroup Profile
 * @apiDescription Create a user profile based on their authentication.
 *
 * @apiBody {String} firstName User's first name.
 * @apiBody {String} lastName User's last name.
 * @apiBody {String} discord User's Discord username.
 * @apiBody {String} avatarUrl User's avatar URL.
 *
 * @apiSuccess (200: Success) {Json} user Created user's profile information.
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 * {
 *    "_id": "abc12345",
 *    "firstName": "Hack",
 *    "lastName": "Illinois",
 *    "discord": "HackIllinois",
 *    "avatarUrl": "na",
 *    "points": 0,
 *    "id": "12345",
 *    "foodWave": 0
 * }
 *
 * @apiError (400: Bad Request) {String} UserAlreadyExists The user profile already exists.
 * @apiError (500: Internal Error) {String} InternalError An internal server error occurred.
 * @apiErrorExample Example Error Response (UserAlreadyExists):
 *     HTTP/1.1 400 Bad Request
 *     {"error": "UserAlreadyExists"}
 *
 * @apiErrorExample Example Error Response (InternalError):
 *     HTTP/1.1 500 Internal Server Error
 *     {"error": "InternalError"}
 */

profileRouter.post("/", strongJwtVerification, async (req: Request, res: Response) => {
    const profile: AttendeeProfile = req.body as AttendeeProfile;

    if (!isValidProfileModel(profile)) {
        return res.status(Constants.BAD_REQUEST).send({ error: "InvalidPostData" });
    }

    const decodedData: JwtPayload = res.locals.payload as JwtPayload;

    profile.userId = decodedData.id;
    profile.points = Constants.DEFAULT_POINT_VALUE;

    const user: AttendeeProfile | null = await AttendeeProfileModel.findOne({ userId: profile.userId });

    if (user) {
        return res.status(Constants.FAILURE).send({ error: "UserAlreadyExists" });
    }

    const profileMetadata: AttendeeMetadata = new AttendeeMetadata(profile.userId, Constants.DEFAULT_FOOD_WAVE);

    try {
        await AttendeeProfileModel.create(profile);
        await AttendeeMetadataModel.create(profileMetadata);
    } catch (error) {
        console.error(error);
        return res.status(Constants.FAILURE).send({ error: "InvalidParams" });
    }

    return res.status(Constants.SUCCESS).send(profile);
});

/**
 * @api {put} /profile/points PUT /profile/points
 * @apiGroup Profile
 * @apiDescription Update a user's points. Only STAFF and ADMIN roles can edit this.
 *
 * @apiBody {String} points new number of points
 *
 * @apiSuccess (200: Success) {Json} profile Updated user point number
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 * {
 *    "points": 5
 * }
 *
 * @apiError (500: Internal Error) {String} InternalError An internal server error occurred.
 * @apiErrorExample Example Error Response (InternalError):
 *     HTTP/1.1 500 Internal Server Error
 *     {"error": "InternalError"}
 */

profileRouter.put("/points", strongJwtVerification, async (req: Request, res: Response) => {
    const profile: AttendeeProfile | null = req.body as AttendeeProfile;

    if (!isValidProfileModel(profile)) {
        return res.status(Constants.BAD_REQUEST).send({ error: "InvalidPutData" });
    }

    const decodedData: JwtPayload = res.locals.payload as JwtPayload;

    if (!hasElevatedPerms(decodedData)) {
        return res.status(Constants.FORBIDDEN).send({ error: "NotAuthorizedToUseEndpoint" });
    }

    const update: UpdateQuery<AttendeeProfile> = {
        $set: {
            points: profile.points,
        },
    };

    await AttendeeProfileModel.updateOne({ userId: decodedData.id }, update);

    return res.status(Constants.SUCCESS).send({ points: profile.points });
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

profileRouter.delete("/", strongJwtVerification, async (_: Request, res: Response) => {
    const decodedData: JwtPayload = res.locals.payload as JwtPayload;

    await AttendeeProfileModel.deleteOne({ userId: decodedData.id });
    await AttendeeMetadataModel.deleteOne({ userId: decodedData.id });

    return res.status(Constants.SUCCESS).send({ success: true });
});

export default profileRouter;
