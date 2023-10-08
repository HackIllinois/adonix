import cors from "cors";
import { Request, Router } from "express";
import { Response } from "express-serve-static-core";

import Constants from "../../constants.js";
import { isValidLimit } from "./profile-lib.js";
import { AttendeeMetadata, AttendeeMetadataModel } from "database/attendee-db.js";

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

    let limit: number = -1;
    let metadata: AttendeeMetadata[] = [];

    if (limitString) {
        try {
            limit = parseInt(limitString);

            if (!isValidLimit) {
                return res.status(Constants.BAD_REQUEST).send({ error: "InvalidLimit" });
            }
            metadata = await AttendeeMetadataModel.find().sort({ score: -1 }).limit(limit);
        } catch (error) {
            console.log(error);
            return res.status(Constants.BAD_REQUEST).send({ error: "InvalidLimit" });
        }
    } else {
        metadata = await AttendeeMetadataModel.find().sort({ score: -1 });
    }

    const leaderboardProfiles: string[] = metadata.map((profile) => {
        return profile.userId;
    });

    return res.status(Constants.SUCCESS).send({
        profiles: leaderboardProfiles,
    });
});

export default profileRouter;
