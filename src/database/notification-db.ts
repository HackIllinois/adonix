import { prop } from "@typegoose/typegoose";

export class NotificationMappings {
    @prop({ required: true })
    public userId: string;

    @prop({ required: true })
    public deviceToken: string;
}

class NotificationMessageBatch {
    @prop({ required: true, type: () => [String] })
    public sent!: string[];

    @prop({ required: true, type: () => [String] })
    public failed!: string[];
}

export class NotificationMessages {
    @prop({ required: true })
    public sender: string;

    @prop({ required: true })
    public title: string;

    @prop({ required: true })
    public body: string;

    @prop({ required: true, type: () => [NotificationMessageBatch] })
    public batches!: NotificationMessageBatch[];
}
