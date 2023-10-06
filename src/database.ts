import { IModelOptions } from "@typegoose/typegoose/lib/types.js";
import "dotenv";
import { MongoClient } from "mongodb";
import mongoose from "mongoose";

const username: string | undefined = process.env.DB_USERNAME;
const password: string | undefined = process.env.DB_PASSWORD;
const server: string | undefined = process.env.DB_SERVER;

const params: string = "?retryWrites=true&w=majority";
const uri: string = `mongodb+srv://${username}:${password}@${server}/${params}`;
const client: MongoClient = new MongoClient(uri);

const existingConnections: Map<string, mongoose.Connection> = new Map();

export function connectToMongoose(dbName: string): mongoose.Connection {
    const url: string = `mongodb+srv://${username}:${password}@${server}/${dbName}${params}`;

    let database: mongoose.Connection | undefined =
        existingConnections.get(dbName);

    if (!database) {
        database = mongoose.createConnection(url);
        existingConnections.set(dbName, database);
    }

    return database;
}

export function generateConfig(
    database: string,
    collection: string,
): IModelOptions {
    const connection: mongoose.Connection = connectToMongoose(database);

    return {
        existingConnection: connection,
        schemaOptions: { collection: collection, versionKey: false },
    };
}

export default client;
