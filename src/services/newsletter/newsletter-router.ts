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
import { readUnsubscribeToken, removeNewsletterSubscriber } from "./newsletter-lib";
import { renderUnsubscribePage } from "./newsletter-view";

const newsletterRouter = Router();

// Register before /:id so these public pages never enter the admin-only list lookup.
for (const method of ["get", "post"] as const) {
    newsletterRouter[method](
        "/unsubscribe/",
        (_req, res, next) => {
            res.set({
                "Cache-Control": "no-store",
                "Referrer-Policy": "no-referrer",
                "X-Content-Type-Options": "nosniff",
                "Content-Security-Policy":
                    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
            });
            next();
        },
        specification({
            method,
            path: "/newsletter/unsubscribe/",
            tag: Tag.NEWSLETTER,
            role: null,
            summary: method === "get" ? "Show newsletter unsubscribe confirmation" : "Confirm newsletter unsubscribe",
            query: z.object({ token: z.string().optional() }),
            responses: {
                [StatusCode.SuccessOK]: { description: "Unsubscribe page", schema: z.string(), contentType: "text/html" },
                [StatusCode.ClientErrorBadRequest]: {
                    description: "Invalid unsubscribe link",
                    schema: z.string(),
                    contentType: "text/html",
                },
                [StatusCode.ServerErrorInternal]: {
                    description: "Temporary unsubscribe failure",
                    schema: z.string(),
                    contentType: "text/html",
                },
            },
        }),
        async (req, res) => {
            const token = typeof req.query.token === "string" ? req.query.token : undefined;
            const identity = readUnsubscribeToken(token);
            res.type("html");
            if (!identity) {
                return res.status(StatusCode.ClientErrorBadRequest).send(renderUnsubscribePage("invalid"));
            }
            if (method === "get") {
                return res.send(renderUnsubscribePage("confirm", token, identity.emailAddress));
            }
            try {
                await removeNewsletterSubscriber(identity.listName, identity.emailAddress);
                return res.send(renderUnsubscribePage("success"));
            } catch {
                return res.status(StatusCode.ServerErrorInternal).send(renderUnsubscribePage("error", token));
            }
        },
    );
}

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

newsletterRouter.delete(
    "/subscribe/",
    specification({
        method: "delete",
        path: "/newsletter/subscribe/",
        tag: Tag.NEWSLETTER,
        role: null,
        summary: "Unsubscribes the requested email to the requested newsletter",
        body: SubscribeRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description:
                    "If the email was subscribed, it no longer is. For privacy reasons, whether this email was subscribed or not is hidden.",
                schema: SuccessResponseSchema,
            },
        },
    }),
    async (req, res) => {
        const { listName, emailAddress } = req.body;

        await removeNewsletterSubscriber(listName, emailAddress);
        return res.status(StatusCode.SuccessOK).send({ success: true });
    },
);

export default newsletterRouter;
