import { getModelForClass, mongoose, prop } from "@typegoose/typegoose";
import Constants from "constants.js";
import { generateConfig } from "database.js";

enum UserDB {
    INFO = "users",
    ATTENDANCE = "attendance",
}

export class UserInfo {
    @prop({ required: true })
    public _id: string;

    @prop({ required: true })
    public userId: string;

    @prop({ required: true })
    public email: string;

    @prop({ required: true })
    public name: string;
}

export class Attendance {
    @prop({ required: true })
    public _id: string;

    @prop({ required: true })
    public userId: string;

    @prop({ required: true })
    public events: string[];
}

export const UserModel: mongoose.Model<UserInfo> = getModelForClass(
    UserInfo,
    generateConfig(Constants.AUTH_DB, UserDB.INFO),
);

export const AttendanceModel: mongoose.Model<Attendance> = getModelForClass(
    Attendance,
    generateConfig(Constants.AUTH_DB, UserDB.ATTENDANCE),
);
