import { Collection, UpdateFilter } from "mongodb";
import { UserSchema } from "./user-schemas.js";
import DatabaseHelper from "../../database.js";
import { UserFormat } from "./user-formats.js";

export async function getUser(userId: string): Promise<UserSchema> {
	const collection: Collection = await DatabaseHelper.getCollection("user", "info");
	console.log("|%s|", userId);
	try {
		const user: UserSchema | null = await collection.findOne({ id: userId }) as UserSchema | null;
		if (user) {
			return user;
		}

		return Promise.reject("no such user found!");
	} catch (error) {
		return Promise.reject(error);
	}
}


export async function updateUser(userData: UserFormat): Promise<void> {
	const collection: Collection = await DatabaseHelper.getCollection("user", "info");

	try {
		const updateFilter: UpdateFilter<UserSchema> = {
			$set: {
				id: userData.id,
				email: userData.email,
				firstname: userData.firstname,
				lastname: userData.lastname,
			}};
		await collection.updateOne({id: userData.id}, updateFilter, {upsert: true});
	} catch (error) {
		return Promise.reject(error as string);
	}

	return Promise.resolve();
}
