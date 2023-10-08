import { getModelForClass, prop } from "@typegoose/typegoose";
import { Databases, generateConfig } from "database.js";
import mongoose from "mongoose";

enum AttendeeDB {
    METADATA = "metadata",
    PROFILE = "profile",
}

export class AttendeeMetadata {
    @prop({ required: true })
    public _id: string;

    @prop({ required: true })
    public userId: string;

    @prop({ required: true })
    public foodWave: number;

    @prop({ required: true })
    public score: number;
}

export class AttendeeProfile {
    @prop({ required: true })
    public _id: string;

    @prop({ required: true })
    public userId: string;

    @prop({ required: true })
    public preferredName: string;

    @prop({ required: true })
    public legalName: string;

    @prop({ required: true })
    public avatarUrl: string;

    @prop({ required: true })
    public discordName: string;
}

export const AttendeeMetadataModel: mongoose.Model<AttendeeMetadata> = getModelForClass(
    AttendeeMetadata,
    generateConfig(Databases.ATTENDEE_DB, AttendeeDB.METADATA),
);

export const AttendeeProfileModel: mongoose.Model<AttendeeProfile> = getModelForClass(
    AttendeeProfile,
    generateConfig(Databases.ATTENDEE_DB, AttendeeDB.PROFILE),
);
