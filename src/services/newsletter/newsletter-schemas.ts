import { prop } from "@typegoose/typegoose";
import { z } from "zod";
import { CreateErrorAndSchema } from "../../common/schemas";

export class NewsletterSubscription {
    @prop({ required: true })
    public newsletterId: string;

    @prop({
        required: true,
        type: () => String,
    })
    public subscribers: string[];
}

export const NewsletterIdSchema = z.string().openapi("NewsletterId", { example: "hackillinois2025_interest" });

export const NewsletterSubscriptionSchema = z
    .object({
        newsletterId: NewsletterIdSchema,
        subscribers: z.array(z.string()),
    })
    .openapi("NewsletterSubscription", {
        example: {
            newsletterId: "hackillinois2025_interest",
            subscribers: ["user1", "user2", "user3"],
        },
    });

export const NewsletterSubscriptionsSchema = z.array(NewsletterSubscriptionSchema).openapi("NewsletterSubscriptions");

export const SubscribeRequestSchema = z
    .object({
        listName: NewsletterIdSchema,
        emailAddress: z.string(),
    })
    .openapi("SubscribeRequest", {
        example: {
            listName: "hackillinois2025_interest",
            emailAddress: "example@example.com",
        },
    });

export const [NewsletterNotFoundError, NewsletterNotFoundErrorSchema] = CreateErrorAndSchema({
    error: "NotFound",
    message: "That newsletter doesn't exist!",
});
