import { IModelOptions } from "@typegoose/typegoose/lib/types.js";
import Config from "./config.js";
import mongoose from "mongoose";

export function connectToMongoose(): void {
    mongoose.connect(Config.DB_URL);
}

export function generateConfig(collection: string): IModelOptions {
    return {
        schemaOptions: { collection: collection, versionKey: false },
    };
}
