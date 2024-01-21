import { prop } from "@typegoose/typegoose";

export class UserInfo {
    @prop({ required: true })
    public userId: string;

    @prop({ required: true })
    public name: string;

    @prop({ required: true })
    public email: string;
}
export class UserAttendance {
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
