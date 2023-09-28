import cors from "cors";
import { Request, Router } from "express";
import { Response } from "express-serve-static-core";
import { Collection, Document, FindCursor, WithId } from "mongodb";

import Constants from "../../constants.js";
import databaseClient from "../../database.js";
import { LeaderboardSchema, ProfileDB } from "./profile-schemas.js";
import { castLeaderboardEntries, errorHandler, isValidLimit, jwtHandler } from "./profile-lib.js";

// import { decodeJwtToken } from "../auth/auth-lib.js";
import { JwtPayload } from "../auth/auth-models.js";
import { Profile } from "./profile-models.js";

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
	const collection: Collection = databaseClient.db(Constants.PROFILE_DB).collection(ProfileDB.PROFILES);
	const limitString: string | undefined = req.query.limit as string | undefined;

	try {
		// Get collection from the database, and return it as an array
		let leaderboardCursor: FindCursor<WithId<Document>> = collection.find().sort({ points: -1 });

		if (limitString) {
			const limit: number = parseInt(limitString);
			
			// If invalid limit - return InvalidInput
			if (!isValidLimit(limit)) {
				return res.status(Constants.BAD_REQUEST).send({ error: "InvalidInput" });
			}
			leaderboardCursor = leaderboardCursor.limit(limit);
		}

		// Return the profiles, after mapping them to simple leaderboard entries
		const leaderboardProfiles: LeaderboardSchema[] = await leaderboardCursor.toArray() as LeaderboardSchema[];
		return res.status(Constants.SUCCESS).send({ profiles: leaderboardProfiles.map(castLeaderboardEntries) });
	} catch {
		return res.status(Constants.INTERNAL_ERROR).send({ error: "InternalError" });
	}
});

/*
TODO:
- finish rest of the endpoints
- figure out implementing JWT on all endpoints
*/

// decode jwt token
// then get the id from there & hit the database (profile/profiles collection) to return the user
profileRouter.get("/profile/", async (req: Request, res: Response) => {
    const collection: Collection = databaseClient.db(Constants.PROFILE_DB).collection(ProfileDB.PROFILES);

    // let jwtToken: string = req.headers.authorization as string;

    try {
        let decodedData: JwtPayload = jwtHandler(req);

        let id: string = decodedData.id;
        const user = await collection.findOne({id: id}) as Profile | null;

        if (!user) {
            return res.status(Constants.INTERNAL_ERROR).send({ error: "InternalError" });
        }

        return res.status(Constants.SUCCESS).send(user);

    } catch (error) {
        return errorHandler(res, error);
    }

});

profileRouter.get("/profile/id/:id", async (req: Request, res: Response) => {
    const collection: Collection = databaseClient.db(Constants.PROFILE_DB).collection(ProfileDB.PROFILES);

    const id = req.params.id;

    try {
        const user = await collection.findOne({id: id}) as Profile | null;

        if (!user) {
            return res.status(Constants.INTERNAL_ERROR).send({ error: "InternalError" });
        }

        return res.status(Constants.SUCCESS).send(user);
    } catch (error) {
        return errorHandler(res, error);
    }
});

profileRouter.post("/profile/", async (req: Request, res: Response) => {
    const collection: Collection = databaseClient.db(Constants.PROFILE_DB).collection(ProfileDB.PROFILES);

    const profile: Profile = req.body;

    // ensure they dont set foodwave or points
    profile.foodWave = 0;
    profile.points = 0;

    try {
        let decodedData: JwtPayload = jwtHandler(req);

        profile.id = decodedData.id;

        await collection.insertOne(profile);
        return res.status(Constants.SUCCESS).send(profile);
    } catch (error) {
        return errorHandler(res, error);
    }
});


export default profileRouter;
