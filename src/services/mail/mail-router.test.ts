import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import Models from "../../common/models";
import { post, postAsAdmin, postAsAttendee, TESTER } from "../../common/testTools";
import { Templates } from "../../common/config";
import * as mail from "./mail-lib";

const message = { subject: "News", body: "<p>Latest news</p>" };
const success = { success: true, successCount: 2, failedCount: 0, errors: [] };

beforeEach(() => {
    jest.spyOn(mail, "sendBulkMail").mockResolvedValue(success);
    jest.spyOn(mail, "sendMail").mockResolvedValue("test-message");
});

describe("POST /mail/send/newsletter/", () => {
    it("reads current subscribers and adds a different personal unsubscribe link to each email", async () => {
        await Models.NewsletterSubscription.create({
            newsletterId: "first",
            subscribers: [" One@example.com ", "one@example.com", "two@example.com"],
        });
        await postAsAdmin("/mail/send/newsletter/")
            .send({ ...message, listName: "first", emails: ["unsubscribed@example.com"] })
            .expect(200);
        const [template, recipients, defaults] = jest.mocked(mail.sendBulkMail).mock.calls[0]!;
        expect(template).toBe(Templates.GENERIC);
        expect(defaults).toEqual({ subject: message.subject });
        expect(recipients.map(({ email }) => email)).toEqual(["one@example.com", "two@example.com"]);
        for (const recipient of recipients) {
            expect(recipient.data?.body).toContain(message.body);
            expect(recipient.data?.body).toContain("Unsubscribe");
            expect(recipient.data?.body).toContain("/newsletter/unsubscribe/?token=");
        }
        expect(recipients[0]?.data?.body).not.toBe(recipients[1]?.data?.body);
    });

    it("does not send to a recipient who unsubscribed after the admin selected the list", async () => {
        await Models.NewsletterSubscription.create({
            newsletterId: "first",
            subscribers: ["one@example.com", "two@example.com"],
        });
        await Models.NewsletterSubscription.updateOne({ newsletterId: "first" }, { $pull: { subscribers: "one@example.com" } });
        await postAsAdmin("/mail/send/newsletter/")
            .send({ ...message, listName: "first" })
            .expect(200);
        expect(jest.mocked(mail.sendBulkMail).mock.calls[0]?.[1].map(({ email }) => email)).toEqual(["two@example.com"]);
    });

    it("requires admin authorization and validates the list name", async () => {
        await post("/mail/send/newsletter/")
            .send({ ...message, listName: "first" })
            .expect(401);
        await postAsAttendee("/mail/send/newsletter/")
            .send({ ...message, listName: "first" })
            .expect(403);
        await postAsAdmin("/mail/send/newsletter/")
            .send({ ...message, listName: "" })
            .expect(400);
        expect(mail.sendBulkMail).not.toHaveBeenCalled();
    });

    it("fails closed for missing, empty, or invalid lists", async () => {
        await postAsAdmin("/mail/send/newsletter/")
            .send({ ...message, listName: "missing" })
            .expect(404);
        await Models.NewsletterSubscription.create({ newsletterId: "empty", subscribers: [] });
        await postAsAdmin("/mail/send/newsletter/")
            .send({ ...message, listName: "empty" })
            .expect(400);
        await Models.NewsletterSubscription.create({ newsletterId: "invalid", subscribers: ["not-an-email"] });
        await postAsAdmin("/mail/send/newsletter/")
            .send({ ...message, listName: "invalid" })
            .expect(400);
        expect(mail.sendBulkMail).not.toHaveBeenCalled();
    });
});

describe("newsletter test emails and operational email compatibility", () => {
    it("includes a personal unsubscribe link in a newsletter test email", async () => {
        await postAsAdmin("/mail/send/self/")
            .send({ ...message, newsletterId: "first" })
            .expect(200);
        expect(mail.sendMail).toHaveBeenCalledWith(
            Templates.GENERIC,
            TESTER.email,
            expect.objectContaining({
                subject: message.subject,
                body: expect.stringContaining("/newsletter/unsubscribe/?token="),
            }),
        );
    });

    it("keeps ordinary test and bulk messages unchanged", async () => {
        await postAsAdmin("/mail/send/self/").send(message).expect(200);
        expect(mail.sendMail).toHaveBeenCalledWith(Templates.GENERIC, TESTER.email, message);
        await postAsAdmin("/mail/send/")
            .send({ ...message, emails: ["person@example.com"] })
            .expect(200);
        expect(mail.sendBulkMail).toHaveBeenCalledWith(Templates.GENERIC, [{ email: "person@example.com" }], message);
    });
});
