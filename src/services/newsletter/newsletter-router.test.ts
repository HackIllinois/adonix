import { describe, expect, it, jest } from "@jest/globals";
import Models from "../../common/models";
import { del, get, post } from "../../common/testTools";
import { createUnsubscribeUrl } from "./newsletter-lib";

function unsubscribePath(listName = "first", emailAddress = "person@example.com"): string {
    const url = new URL(createUnsubscribeUrl(listName, emailAddress));
    return url.pathname + url.search;
}

describe("public newsletter unsubscribe", () => {
    it("documents HTML pages while preserving JSON responses for existing APIs", async () => {
        const response = await get("/docs/json").expect(200);
        const { paths } = JSON.parse(response.text);
        expect(paths["/newsletter/unsubscribe/"].get.responses["200"].content["text/html"]).toBeDefined();
        expect(paths["/newsletter/unsubscribe/"].post.responses["200"].content["text/html"]).toBeDefined();
        expect(paths["/newsletter/"].get.responses["200"].content["application/json"]).toBeDefined();
    });

    it("shows confirmation without signing in or changing subscriptions on GET", async () => {
        await Models.NewsletterSubscription.create({ newsletterId: "first", subscribers: ["person@example.com"] });
        const response = await get(unsubscribePath()).expect(200);
        expect(response.type).toBe("text/html");
        expect(response.text).toContain('method="post"');
        expect(response.text).toContain("Unsubscribe");
        expect(response.headers["cache-control"]).toBe("no-store");
        expect(response.headers["referrer-policy"]).toBe("no-referrer");
        expect((await Models.NewsletterSubscription.findOne({ newsletterId: "first" }))?.subscribers).toEqual([
            "person@example.com",
        ]);
    });

    it("removes only this list's matching address, including legacy casing and whitespace", async () => {
        await Models.NewsletterSubscription.create({
            newsletterId: "first",
            subscribers: [" Person@Example.com ", "person@example.com", "other@example.com"],
        });
        await Models.NewsletterSubscription.create({ newsletterId: "second", subscribers: ["person@example.com"] });
        const path = unsubscribePath();
        const response = await post(path).expect(200);
        expect(response.type).toBe("text/html");
        expect(response.text).toContain("unsubscribed");
        await post(path).expect(200);
        expect((await Models.NewsletterSubscription.findOne({ newsletterId: "first" }))?.subscribers).toEqual([
            "other@example.com",
        ]);
        expect((await Models.NewsletterSubscription.findOne({ newsletterId: "second" }))?.subscribers).toEqual([
            "person@example.com",
        ]);
    });

    it("treats a missing list or address as success without creating a newsletter", async () => {
        await post(unsubscribePath()).expect(200);
        expect(await Models.NewsletterSubscription.countDocuments()).toBe(0);
    });

    it("rejects invalid or missing links without revealing subscriber data or changing it", async () => {
        await Models.NewsletterSubscription.create({ newsletterId: "first", subscribers: ["person@example.com"] });
        for (const path of ["/newsletter/unsubscribe/", "/newsletter/unsubscribe/?token=bad"]) {
            const response = await get(path).expect(400);
            expect(response.type).toBe("text/html");
            expect(response.text).not.toContain("person@example.com");
            await post(path).expect(400);
        }
        expect((await Models.NewsletterSubscription.findOne({ newsletterId: "first" }))?.subscribers).toEqual([
            "person@example.com",
        ]);
    });

    it("shows a retry page when removal fails instead of claiming success", async () => {
        jest.spyOn(Models.NewsletterSubscription, "updateOne").mockRejectedValueOnce(new Error("Database unavailable"));
        const response = await post(unsubscribePath()).expect(500);
        expect(response.type).toBe("text/html");
        expect(response.text).toContain("Try again");
        expect(response.text).not.toContain("Database unavailable");
    });

    it("keeps the existing DELETE API working without creating missing lists", async () => {
        await del("/newsletter/subscribe/").send({ listName: "missing", emailAddress: "person@example.com" }).expect(200);
        expect(await Models.NewsletterSubscription.countDocuments()).toBe(0);
    });
});
