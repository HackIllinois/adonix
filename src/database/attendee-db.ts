import { getModelForClass, prop } from "@typegoose/typegoose";
import { Databases, generateConfig } from "../database.js";
import mongoose from "mongoose";

enum AttendeeDB {
    METADATA = "metadata",
    PROFILE = "profile",
}

export class AttendeeMetadata {
    @prop({ required: true })
    public userId: string;

    @prop({ required: true })
    public foodWave: number;

    constructor(id: string, wave: number) {
        this.userId = id;
        this.foodWave = wave;
    }
}

export class AttendeeProfile {
    @prop({ required: true })
    public userId: string;

    @prop({ required: true })
    public displayName: string;

    @prop({ required: true })
    public avatarUrl: string;

    @prop({ required: true })
    public discordTag: string;

    @prop({ required: true })
    public points: number;
}

export const AttendeeMetadataModel: mongoose.Model<AttendeeMetadata> = getModelForClass(
    AttendeeMetadata,
    generateConfig(Databases.ATTENDEE_DB, AttendeeDB.METADATA),
);

export const AttendeeProfileModel: mongoose.Model<AttendeeProfile> = getModelForClass(
    AttendeeProfile,
    generateConfig(Databases.ATTENDEE_DB, AttendeeDB.PROFILE),
);
