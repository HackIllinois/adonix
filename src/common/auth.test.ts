import { describe, it, expect } from "@jest/globals";
import { JwtPayload, Provider, Role } from "../services/auth/auth-schemas";
import Models from "../database/models";
import { AuthInfo } from "../services/auth/auth-schemas";
import { getJwtPayloadFromProfile } from "./auth";

const USER_PAYLOAD = {
    id: "user",
    email: "user@gmail.com",
    provider: Provider.GITHUB,
    roles: [Role.USER],
} satisfies JwtPayload;

const STAFF_PAYLOAD = {
    id: "staff",
    email: "staff@hackillinois.org",
    provider: Provider.GOOGLE,
    roles: [Role.USER, Role.STAFF],
} satisfies JwtPayload;

const ADMIN_PAYLOAD = {
    id: "admin",
    email: "admin@hackillinois.org",
    provider: Provider.GOOGLE,
    roles: [Role.USER, Role.STAFF, Role.ADMIN],
} satisfies JwtPayload;

// NOTE: This test suite will only test functions not well covered elsewhere.

describe("getJwtPayloadFromProfile", () => {
    it.each([
        ["user", USER_PAYLOAD],
        ["staff", STAFF_PAYLOAD],
        ["admin", ADMIN_PAYLOAD],
    ])("creates auth info for a new %s", async (_name, payload) => {
        const newPayload = await getJwtPayloadFromProfile(
            payload.provider,
            {
                id: payload.id,
                email: payload.email,
            },
            true,
        );

        const newUserId = `${payload.provider}${payload.id}`;

        expect(newPayload).toMatchObject({
            ...payload,
            id: newUserId,
        } satisfies JwtPayload);

        const stored = await Models.AuthInfo.findOne({ userId: newPayload.id });

        expect(stored).toMatchObject({
            userId: newPayload.id,
            provider: newPayload.provider,
            roles: newPayload.roles,
        } satisfies AuthInfo);
    });
    it.each([
        ["user", USER_PAYLOAD],
        ["staff", STAFF_PAYLOAD],
        ["admin", ADMIN_PAYLOAD],
    ])("updates auth info for a existing %s", async (_name, payload) => {
        await Models.AuthInfo.create({
            userId: `${payload.provider}${payload.id}`,
            provider: payload.provider,
            roles: [],
        } satisfies AuthInfo);

        const newPayload = await getJwtPayloadFromProfile(
            payload.provider,
            {
                id: payload.id,
                email: payload.email,
            },
            false,
        );

        expect(newPayload).toMatchObject(payload);

        const stored = await Models.AuthInfo.findOne({ userId: newPayload.id });

        expect(stored).toMatchObject({
            userId: newPayload.id,
            provider: newPayload.provider,
            roles: newPayload.roles,
        } satisfies AuthInfo);
    });
});
