import { Router } from "express";
import { NewsletterSubscription, SubscribeRequestSchema } from "./newsletter-schemas";
import Models from "../../database/models";
import { UpdateQuery } from "mongoose";
import { StatusCode } from "status-code-enum";
import specification, { Tag } from "../../middleware/specification";
import { SuccessResponseSchema } from "../../common/schemas";

const newsletterRouter = Router();

newsletterRouter.post(
    "/subscribe/",
    specification({
        method: "post",
        path: "/newsletter/subscribe/",
        tag: Tag.NEWSLETTER,
        role: null,
        summary: "Subscribes the requested email to the requested newsletter",
        body: SubscribeRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Successfully added email to newsletter",
                schema: SuccessResponseSchema,
            },
        },
    }),
    async (request, res) => {
        const { listName, emailAddress } = request.body;

        const updateQuery: UpdateQuery<NewsletterSubscription> = { $addToSet: { subscribers: emailAddress } };
        await Models.NewsletterSubscription.findOneAndUpdate({ newsletterId: listName }, updateQuery, { upsert: true });
        return res.status(StatusCode.SuccessOK).send({ success: true });
    },
);

export default newsletterRouter;
