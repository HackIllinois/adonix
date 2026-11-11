import { describe, expect, it } from "@jest/globals";
import { createUnsubscribeUrl, readUnsubscribeToken } from "./newsletter-lib";
import { generateJwtToken } from "../../common/auth";
import { Provider, Role } from "../auth/auth-schemas";

describe("newsletter unsubscribe links", () => {
    it("binds the link to one normalized email and mailing list", () => {
        const url = new URL(createUnsubscribeUrl("hackillinois2026_interest", " Person+news@Example.com "));
        expect(url.pathname).toBe("/newsletter/unsubscribe/");
        expect(readUnsubscribeToken(url.searchParams.get("token"))).toEqual({
            listName: "hackillinois2026_interest",
            emailAddress: "person+news@example.com",
        });
    });

    it("rejects a changed list or email, a damaged signature, and malformed tokens", () => {
        const token = new URL(createUnsubscribeUrl("first", "person@example.com")).searchParams.get("token")!;
        const [payload, signature] = token.split(".");
        const changed = Buffer.from(JSON.stringify({ listName: "second", emailAddress: "person@example.com" })).toString(
            "base64url",
        );
        const changedEmail = Buffer.from(JSON.stringify({ listName: "first", emailAddress: "other@example.com" })).toString(
            "base64url",
        );
        for (const invalid of [
            undefined,
            null,
            "",
            "bad",
            `${changed}.${signature}`,
            `${changedEmail}.${signature}`,
            `${payload}.bad`,
            `${token}.extra`,
        ]) {
            expect(readUnsubscribeToken(invalid)).toBeNull();
        }
    });

    it("does not accept an authentication token as unsubscribe authorization", () => {
        const token = generateJwtToken({
            id: "tester",
            email: "person@example.com",
            provider: Provider.GITHUB,
            roles: [Role.USER],
        });
        expect(readUnsubscribeToken(token)).toBeNull();
    });
});
