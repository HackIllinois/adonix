import { Collection } from "mongodb";
import databaseClient from "../../database.js";
import Constants from "../../constants.js";
import { RegistrationDB, MentorSchema } from "./registration-schemas.js";


export async function getMentor(userID: string):Promise<MentorSchema> {
	const collection: Collection = databaseClient.db(Constants.REGISTRATION_DB).collection(RegistrationDB.MENTORS);
	try {
		const mentor: MentorSchema | null = await collection.findOne({ id: userID }) as MentorSchema | null;
		if (mentor) {
			return mentor;
		}
		return Promise.reject("MentorNotFound");
	} catch {
		return Promise.reject("InternalError");
	}
}
