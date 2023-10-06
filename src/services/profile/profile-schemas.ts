import { Document, ObjectId, WithId } from "mongodb";

import { LeaderboardEntry } from "./profile-models";

// Schema for each MongoDB
export interface LeaderboardSchema extends LeaderboardEntry, WithId<Document> {
    _id: ObjectId;
}

// Collections within the profile database
export enum ProfileDB {
    PROFILE_ATTENDANCE = "profileattendance",
    PROFILE_FAVORITES = "profilefavorites",
    PROFILE_IDS = "profileids",
    PROFILES = "profiles",
}
