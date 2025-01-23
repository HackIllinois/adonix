import { Router } from "express";
import {
    NewsletterIdSchema,
    NewsletterNotFoundError,
    NewsletterNotFoundErrorSchema,
    NewsletterSubscription,
    NewsletterSubscriptionSchema,
    NewsletterSubscriptionsSchema,
    SubscribeRequestSchema,
} from "./newsletter-schemas";
import Models from "../../common/models";
import { UpdateQuery } from "mongoose";
import { StatusCode } from "status-code-enum";
import specification, { Tag } from "../../middleware/specification";
import { SuccessResponseSchema } from "../../common/schemas";
import { Role } from "../auth/auth-schemas";
import { z } from "zod";

const newsletterRouter = Router();

newsletterRouter.get(
    "/",
    specification({
        method: "get",
        path: "/newsletter/",
        tag: Tag.NEWSLETTER,
        role: Role.ADMIN,
        summary: "Gets all of the newsletter and their subscribers",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Successfully got the subscribers",
                schema: NewsletterSubscriptionsSchema,
            },
        },
    }),
    async (_req, res) => {
        const subscriptions = await Models.NewsletterSubscription.find();
        return res.status(StatusCode.SuccessOK).send(subscriptions);
    },
);

newsletterRouter.get(
    "/:id",
    specification({
        method: "get",
        path: "/newsletter/{id}/",
        tag: Tag.NEWSLETTER,
        role: Role.ADMIN,
        summary: "Gets a newsletter and it's subscribers",
        parameters: z.object({
            id: NewsletterIdSchema,
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Successfully got the subscribers",
                schema: NewsletterSubscriptionSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "That newsletter does not exist",
                schema: NewsletterNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const subscription = await Models.NewsletterSubscription.findOne({
            newsletterId: req.params.id,
        });
        if (!subscription) {
            return res.status(StatusCode.ClientErrorNotFound).send(NewsletterNotFoundError);
        }
        return res.status(StatusCode.SuccessOK).send(subscription);
    },
);

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
    async (req, res) => {
        const { listName, emailAddress } = req.body;

        const updateQuery: UpdateQuery<NewsletterSubscription> = { $addToSet: { subscribers: emailAddress } };
        await Models.NewsletterSubscription.findOneAndUpdate({ newsletterId: listName }, updateQuery, { upsert: true });
        return res.status(StatusCode.SuccessOK).send({ success: true });
    },
);

export default newsletterRouter;
