import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
import Config from "../../common/config";
import Models from "../../common/models";

const UnsubscribeIdentitySchema = z.object({ listName: z.string().min(1), emailAddress: z.string().email() }).strict();
type UnsubscribeIdentity = z.infer<typeof UnsubscribeIdentitySchema>;

function signPayload(payload: string): string {
    // A distinct purpose keeps these links separate from login tokens, even when sharing a signing key.
    return createHmac("sha256", Config.JWT_SECRET).update(`newsletter-unsubscribe:v1:${payload}`).digest("base64url");
}

export function createUnsubscribeUrl(listName: string, emailAddress: string): string {
    const identity = UnsubscribeIdentitySchema.parse({ listName, emailAddress: emailAddress.trim().toLowerCase() });
    const payload = Buffer.from(JSON.stringify(identity)).toString("base64url");
    const url = new URL("/newsletter/unsubscribe/", Config.ROOT_URL);
    url.searchParams.set("token", `${payload}.${signPayload(payload)}`);
    return url.href;
}

export function readUnsubscribeToken(token: unknown): UnsubscribeIdentity | null {
    if (typeof token !== "string") {
        return null;
    }
    const parts = token.split(".");
    const [payload, signature] = parts;
    if (parts.length !== 2 || !payload || !signature || !/^[A-Za-z0-9_-]+$/.test(signature)) {
        return null;
    }
    const expected = Buffer.from(signPayload(payload));
    const supplied = Buffer.from(signature);
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
        return null;
    }
    try {
        const identity = UnsubscribeIdentitySchema.safeParse(JSON.parse(Buffer.from(payload, "base64url").toString()));
        return identity.success ? identity.data : null;
    } catch {
        return null;
    }
}

export async function removeNewsletterSubscriber(listName: string, emailAddress: string): Promise<void> {
    const escaped = emailAddress.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Signups historically kept casing and whitespace. Remove every equivalent address, and never upsert.
    const address = new RegExp(`^\\s*${escaped}\\s*$`, "i");
    await Models.NewsletterSubscription.updateOne({ newsletterId: listName }, { $pull: { subscribers: address } });
}
