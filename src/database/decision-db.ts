import { getModelForClass, mongoose, prop } from "@typegoose/typegoose";
import { Databases, generateConfig } from "database.js";

enum DecisionDB {
    INFO = "info",
    ENTRIES = "entries",
}

enum DecisionStatus {
    TBD = "TBD",
    ACCEPTED = "ACCEPTED",
    REJECTED = "REJECTED",
    WAITLISTED = "WAITLISTED",
}

enum DecisionResponse {
    PENDING = "PENDING",
    ACCEPTED = "ACCEPTED",
    DECLINED = "DECLINED",
}

export class DecisionInfo {
    @prop({ required: true })
    public _id: string;

    @prop({ required: true })
    public userId: string;

    @prop({ required: true })
    public status: DecisionStatus;

    @prop({ required: true })
    public response: DecisionResponse;
}

export class DecisionEntry {
    @prop({ required: true })
    public _id: string;

    @prop({ required: true })
    public userId: string;

    @prop({ required: true })
    public wave: number;

    @prop({ required: true })
    public reviewer: string;

    @prop({ required: true })
    public timestamp: number;

    @prop({ required: true })
    public decision: DecisionStatus;
}

export const DecisionInfoModel: mongoose.Model<DecisionInfo> = getModelForClass(
    DecisionInfo,
    generateConfig(Databases.DECISION_DB, DecisionDB.INFO),
);

export const DecisionEntryModel: mongoose.Model<DecisionEntry> = getModelForClass(
    DecisionEntry,
    generateConfig(Databases.DECISION_DB, DecisionDB.ENTRIES),
);
