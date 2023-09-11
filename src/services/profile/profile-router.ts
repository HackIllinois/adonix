import cors, { CorsOptions } from "cors";
import { Request, Router } from "express";
import { Response } from "express-serve-static-core";
import { Collection, Document, FindCursor, WithId } from "mongodb";

import Constants from "../../constants.js";
import DatabaseHelper from "../../database.js";
import { LeaderboardSchema } from "./profile-schemas.js";
import { castLeaderboardEntries, isValidLimit } from "./profile-lib.js";

const profileRouter: Router = Router();
profileRouter.use(cors({ origin: '*' }));


/**
 * @api {get} /profile/leaderboard/ GET /profile/leaderboard/
 * @apiName Leaderboard
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
	const collection: Collection = await DatabaseHelper.getCollection("profile", "profiles");
	const limitString: string | undefined = req.query.limit as string | undefined;

	try {
		// Get collection from the database, and return it as an array
		let leaderboardCursor: FindCursor<WithId<Document>> = collection.find().sort({ points: -1 });

		if (limitString) {
			const limit: number = parseInt(limitString);
			
			// If invalid limit - return InvalidInput
			if (!isValidLimit(limit)) {
				res.status(Constants.BAD_REQUEST).send({ error: "InvalidInput" });
				return;
			}
			leaderboardCursor = leaderboardCursor.limit(limit);
		}

		// Return the profiles, after mapping them to simple leaderboard entries
		const leaderboardProfiles: LeaderboardSchema[] = await leaderboardCursor.toArray() as LeaderboardSchema[];
		res.status(Constants.SUCCESS).send({ profiles: leaderboardProfiles.map(castLeaderboardEntries) });
		return;
	} catch {
		res.status(Constants.INTERNAL_ERROR).send({ error: "InternalError" });
		return;
	}
});


export default profileRouter;
