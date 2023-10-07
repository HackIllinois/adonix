import { Document, ObjectId, WithId } from "mongodb";
import { RoleData } from "./auth-models.js";

// Auth roles schema
export interface RolesSchema extends WithId<Document>, RoleData {
    _id: ObjectId;
}

// Collections within the auth database
export enum AuthDB {
    ROLES = "roles",
}
