import { Router } from "express";
import { StatusCode } from "status-code-enum";
import { Role } from "../auth/auth-schemas";
import { sendMail, sendBulkMail } from "./mail-lib";
import specification, { Tag } from "../../middleware/specification";
import {
    MailSendSelfSchema,
    MailSendSchema,
    MailSendAttendeesSchema,
    MailSendResultSchema,
    MailBulkSendResultSchema,
    UserEmailNotFoundError,
    UserEmailNotFoundErrorSchema,
    MailSendNewsletterSchema,
    NewsletterRecipientsInvalidError,
    NewsletterRecipientsInvalidErrorSchema,
} from "./mail-schemas";
import { Templates } from "../../common/config";
import { getAuthenticatedUser } from "../../common/auth";
import Models from "../../common/models";
import { NewsletterNotFoundError, NewsletterNotFoundErrorSchema } from "../newsletter/newsletter-schemas";
import { createUnsubscribeUrl } from "../newsletter/newsletter-lib";
import { renderUnsubscribeEmailFooter } from "../newsletter/newsletter-view";
import { z } from "zod";

const mailRouter = Router();

mailRouter.post(
    "/send/self/",
    specification({
        method: "post",
        path: "/mail/send/self/",
        tag: Tag.MAIL,
        role: Role.ADMIN,
        summary: "Send a generic email to yourself",
        description: "Looks up the authenticated user's email from the user collection and sends them a generic email.",
        body: MailSendSelfSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Email sent successfully",
                schema: MailSendResultSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "User email not found",
                schema: UserEmailNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const payload = getAuthenticatedUser(req);

        if (!payload.email) {
            return res.status(StatusCode.ClientErrorNotFound).json(UserEmailNotFoundError);
        }

        const { subject, body, newsletterId } = req.body;
        const footer = newsletterId ? renderUnsubscribeEmailFooter(createUnsubscribeUrl(newsletterId, payload.email)) : "";
        await sendMail(Templates.GENERIC, payload.email, { subject, body: body + footer });

        return res.status(StatusCode.SuccessOK).json({ success: true });
    },
);

mailRouter.post(
    "/send/newsletter/",
    specification({
        method: "post",
        path: "/mail/send/newsletter/",
        tag: Tag.MAIL,
        role: Role.ADMIN,
        summary: "Send to current newsletter subscribers with personal unsubscribe links",
        body: MailSendNewsletterSchema,
        responses: {
            [StatusCode.SuccessOK]: { description: "Bulk send results", schema: MailBulkSendResultSchema },
            [StatusCode.ClientErrorNotFound]: { description: "Newsletter not found", schema: NewsletterNotFoundErrorSchema },
            [StatusCode.ClientErrorBadRequest]: {
                description: "Newsletter audience is empty or invalid",
                schema: NewsletterRecipientsInvalidErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { subject, body, listName } = req.body;
        const newsletter = await Models.NewsletterSubscription.findOne({ newsletterId: listName });
        if (!newsletter) {
            return res.status(StatusCode.ClientErrorNotFound).send(NewsletterNotFoundError);
        }
        const emails = [...new Set(newsletter.subscribers.map((email) => email.trim().toLowerCase()).filter(Boolean))];
        if (!emails.length || !z.array(z.string().email()).safeParse(emails).success) {
            return res.status(StatusCode.ClientErrorBadRequest).send(NewsletterRecipientsInvalidError);
        }
        const result = await sendBulkMail(
            Templates.GENERIC,
            emails.map((email) => ({
                email,
                data: { body: body + renderUnsubscribeEmailFooter(createUnsubscribeUrl(listName, email)) },
            })),
            { subject },
        );
        return res.status(StatusCode.SuccessOK).json(result);
    },
);

mailRouter.post(
    "/send/",
    specification({
        method: "post",
        path: "/mail/send/",
        tag: Tag.MAIL,
        role: Role.ADMIN,
        summary: "Bulk send a generic email",
        description: "Sends a generic email with the given subject and body to all provided email addresses.",
        body: MailSendSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Bulk send results",
                schema: MailBulkSendResultSchema,
            },
        },
    }),
    async (req, res) => {
        const { subject, body, emails } = req.body;

        const result = await sendBulkMail(
            Templates.GENERIC,
            emails.map((email) => ({ email })),
            { subject, body },
        );

        return res.status(StatusCode.SuccessOK).json(result);
    },
);

mailRouter.post(
    "/send/attendees/",
    specification({
        method: "post",
        path: "/mail/send/attendees/",
        tag: Tag.MAIL,
        role: Role.ADMIN,
        summary: "Send a generic email to all attendees",
        description:
            "Fetches all attendee profiles, joins with registration submissions to get emails, and sends a generic email to each.",
        body: MailSendAttendeesSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Bulk send results",
                schema: MailBulkSendResultSchema,
            },
        },
    }),
    async (req, res) => {
        const { subject, body } = req.body;

        const attendeeProfiles = await Models.AttendeeProfile.find().select("userId");
        const attendeeUserIds = attendeeProfiles.map((profile) => profile.userId);

        const registrations = await Models.RegistrationApplicationSubmitted.find({
            userId: { $in: attendeeUserIds },
        }).select("email");

        const emails = registrations.map((registration) => registration.email);

        const result = await sendBulkMail(
            Templates.GENERIC,
            emails.map((email) => ({ email })),
            { subject, body },
        );

        return res.status(StatusCode.SuccessOK).json(result);
    },
);

export default mailRouter;
