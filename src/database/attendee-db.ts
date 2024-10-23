import { prop } from "@typegoose/typegoose";

export class AttendeeProfile {
    @prop({ required: true })
    public userId: string;

    @prop({ required: true })
    public displayName: string;

    @prop({ required: true })
    public avatarUrl: string;

    @prop({ required: true })
    public discordTag: string;

    @prop({ required: true })
    public points: number;

    @prop({ required: true })
    public coins: number;

    @prop({ required: true })
    public foodWave: number;
}
