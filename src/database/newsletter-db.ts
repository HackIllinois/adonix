import { getModelForClass, mongoose, prop } from "@typegoose/typegoose";
import { Databases, generateConfig } from "../database.js";

enum NewsletterDB {
    SUBSCRIPTIONS = "subscriptions",
}

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

export const NewsletterSubscriptionModel: mongoose.Model<NewsletterSubscription> = getModelForClass(
    NewsletterSubscription,
    generateConfig(Databases.NEWSLETTER_DB, NewsletterDB.SUBSCRIPTIONS),
);
