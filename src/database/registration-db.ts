import { prop } from "@typegoose/typegoose";

export class RegistrationInfo {
    @prop({ required: true })
    public userId: string;

    @prop({ required: true })
    public preferredName: string;

    @prop({ required: true })
    public userName: string;
}

export class RegistrationApplication {
    @prop({ required: true })
    public userId: string;

    @prop({ required: true })
    public resume: string;

    @prop({ required: true, type: String })
    public essays: string[];
}
