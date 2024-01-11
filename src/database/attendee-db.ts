import { prop } from "@typegoose/typegoose";

export class AttendeeMetadata {
    @prop({ required: true })
    public userId: string;

    @prop({ required: true })
    public foodWave: number;

    constructor(id: string, wave: number) {
        this.userId = id;
        this.foodWave = wave;
    }
}

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

    @prop({ required: true})
    public coins: number;
}

export class AttendeeFollowing {
    @prop({ required: true })
    public userId: string;

    @prop({
        required: true,
        type: () => {
            return String;
        },
    })
    public following: string[];
}
