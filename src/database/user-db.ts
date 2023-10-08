import { getModelForClass, mongoose, prop } from "@typegoose/typegoose";
import { Databases, generateConfig } from "database.js";

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

export class UserAttendance {
    @prop({ required: true })
    public _id: string;

    @prop({ required: true })
    public userId: string;

    @prop({
        required: true,
        type: () => {
            return String;
        },
    })
    public attendance: string[];
}

export const UserInfoModel: mongoose.Model<UserInfo> = getModelForClass(UserInfo, generateConfig(Databases.AUTH_DB, UserDB.INFO));

export const UserAttendanceModel: mongoose.Model<UserAttendance> = getModelForClass(
    UserAttendance,
    generateConfig(Databases.AUTH_DB, UserDB.ATTENDANCE),
);
