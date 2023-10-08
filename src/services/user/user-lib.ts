import { Collection, UpdateFilter } from "mongodb";
import { UserDB, UserSchema } from "./user-schemas.js";
import databaseClient from "../../database.js";
import { UserFormat } from "./user-formats.js";
import Constants from "../../constants.js";

/**
 * Get information from user database about a user.
 * @param userId
 * @returns Promise, if successful then data about the user. If failed, contains error.
 */
export async function getUser(userId: string): Promise<UserSchema> {
    const collection: Collection = databaseClient.db(Constants.USER_DB).collection(UserDB.INFO);
    try {
        const user: UserSchema | null = (await collection.findOne({
            id: userId,
        })) as UserSchema | null;
        if (user) {
            return user;
        }
        return Promise.reject("UserNotFound");
    } catch (error) {
        return Promise.reject("InternalError");
    }
}

/**
 * Update an EXISTING user's data, given new data. User must exist in this database to be updated.
 * @param userData New information about user to add
 * @returns Promise, containing nothing if successful but error if rejected.
 */
export async function updateUser(userData: UserFormat): Promise<void> {
    const collection: Collection = databaseClient.db(Constants.USER_DB).collection(UserDB.INFO);

    try {
        // Create the query to run the update, then perform the update operation
        const updateFilter: UpdateFilter<UserSchema> = {
            $set: {
                id: userData.id,
                email: userData.email,
                firstname: userData.firstname,
                lastname: userData.lastname,
            },
        };
        await collection.updateOne({ id: userData.id }, updateFilter, {
            upsert: true,
        });
    } catch (error) {
        console.error(error);
        return Promise.reject("InternalError");
    }

    return Promise.resolve();
}
