import { prop } from "@typegoose/typegoose";

export class UserInfo {
    @prop({ required: true })
    public userId: string;

    @prop({ required: true })
    public email: string;

    @prop({ required: true })
    public name: string;
}

export class UserAttendance {
    @prop({ required: true })
    public userId: string;

    @prop({
        required: true,
        type: () => String,
    })
    public attendance: string[];
}
