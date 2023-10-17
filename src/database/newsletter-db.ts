import { prop } from "@typegoose/typegoose";

export class NewsletterSubscription {
    @prop({ required: true })
    public newsletterId: string;

    @prop({
        required: true,
        type: () => {
            return String;
        },
    })
    public subscribers: string[];
}
