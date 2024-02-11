import { prop } from "@typegoose/typegoose";

export class NotificationMappings {
    @prop({ required: true })
    public userId: string;

    @prop({ required: true })
    public deviceToken: string;
}

export class NotificationMessages {
    @prop({ required: true })
    public sender: string;

    @prop({ required: true })
    public title: string;

    @prop({ required: true })
    public body: string;

    @prop({ required: true })
    public recipientCount: number;
}
