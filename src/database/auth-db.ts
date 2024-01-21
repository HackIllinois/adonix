import { prop } from "@typegoose/typegoose";

export class AuthInfo {
    @prop({ required: true })
    public userId: string;

    @prop({ required: true })
    public provider: string;

    @prop({
        required: true,
        type: () => String,
    })
    public roles: string[];
}
