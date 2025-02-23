import { prop } from "@typegoose/typegoose";

export class Sponsor {
    @prop({ required: true })
    public userId: string;

    @prop({ required: true })
    public email: string;

    @prop({ required: true })
    public name: string;
}
