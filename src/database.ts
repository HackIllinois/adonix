import { IModelOptions } from "@typegoose/typegoose/lib/types.js";
import { getBaseURL } from "./database/base-url.js";
import mongoose from "mongoose";

const params: string = "?retryWrites=true&w=majority";
const existingConnections: Map<string, mongoose.Connection> = new Map();

export function connectToMongoose(dbName: string): mongoose.Connection {
    const url: string = `${getBaseURL()}${dbName}${params}`;

    let database: mongoose.Connection | undefined = existingConnections.get(dbName);

    if (!database) {
        database = mongoose.createConnection(url);
        existingConnections.set(dbName, database);
    }

    return database;
}

export function generateConfig(database: string, collection: string): IModelOptions {
    const connection: mongoose.Connection = connectToMongoose(database);

    return {
        existingConnection: connection,
        schemaOptions: { collection: collection, versionKey: false },
    };
}

export enum Database {
    AUTH = "auth",
    USER = "user",
    EVENT = "event",
    DECISION = "decision",
    ATTENDEE = "attendee",
    NEWSLETTER = "newsletter",
    REGISTRATION = "registration",
}
