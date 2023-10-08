import { prop, getModelForClass, mongoose } from "@typegoose/typegoose";
import { Databases, generateConfig } from "../database.js";

enum RegistrationDB {
    INFO = "info",
    APPLICATION = "application",
}

export class RegistrationInfo {
    @prop({ required: true })
    public _id: string;

    @prop({ required: true })
    public userId: string;

    @prop({ required: true })
    public preferredName: string;

    @prop({ required: true })
    public userName: string;
}

export class Application {
    @prop({ required: true })
    public _id: string;

    @prop({ required: true })
    public userId: string;
}

export const DecisionInfoModel: mongoose.Model<RegistrationInfo> = getModelForClass(
    RegistrationInfo,
    generateConfig(Databases.DECISION_DB, RegistrationDB.INFO),
);

export const ApplicationModel: mongoose.Model<Application> = getModelForClass(
    Application,
    generateConfig(Databases.DECISION_DB, RegistrationDB.APPLICATION),
);
