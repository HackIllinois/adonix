import { prop } from "@typegoose/typegoose";
import { z } from "zod";

export class NewsletterSubscription {
    @prop({ required: true })
    public newsletterId: string;

    @prop({
        required: true,
        type: () => String,
    })
    public subscribers: string[];
}

export const SubscribeRequestSchema = z
    .object({
        listName: z.string(),
        emailAddress: z.string(),
    })
    .openapi("SubscribeRequest", {
        example: {
            listName: "recruitment_interest",
            emailAddress: "example@example.com",
        },
    });
