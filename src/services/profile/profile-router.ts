import { Request, Router } from "express";
import { Response } from "express-serve-static-core";
import { Collection, Document, FindCursor, WithId } from "mongodb";

import Constants from "../../constants.js";
import DatabaseHelper from "../../database.js";
import { LeaderboardSchema } from "./profile-schemas.js";
import { castLeaderboardEntries } from "./profile-lib.js";

const eventsRouter: Router = Router();

/**
 * @api {get} /event/ GET /event/
 * @apiName Event
 * @apiGroup Event
 * @apiDescription Get all the publicly-available events
 *
 * @apiSuccess (200: Success) {Json} events All publicly-facing events.
 * @apiSuccessExample Example Success Response:
 * @apiError (500: Internal Error) {String} InternalError Database operation failed.
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 500 Internal Server Error
 *     {"error": "InternalError"}
 */
eventsRouter.get("/leaderboard/", async (req: Request, res: Response) => {
	const collection: Collection = await DatabaseHelper.getCollection("profile", "profiles");
	const limitString: string | undefined = req.query.limit as string | undefined;

	try {
		// Get collection from the database, and return it as an array
		let leaderboardCursor: FindCursor<WithId<Document>> = collection.find().sort({ points: -1 });

		if (limitString) {
			const limit: number = parseInt(limitString);
			leaderboardCursor = leaderboardCursor.limit(limit);
			// leaderboardCursor = collection.find().sort({points: -1,}).limit(limit);
		// } else {
		// 	leaderboardCursor = collection.find().sort({points: -1,});
		}

		const leaderboardProfiles: LeaderboardSchema[] = await leaderboardCursor.toArray() as LeaderboardSchema[];

		res.status(Constants.SUCCESS).send({ profiles: leaderboardProfiles.map(castLeaderboardEntries) });
	} catch {
		res.status(Constants.INTERNAL_ERROR).send({ error: "InternalError" });
	}
});


export default eventsRouter;
