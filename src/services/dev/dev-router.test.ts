import { describe, it, expect, beforeEach } from "@jest/globals";
import { StatusCode } from "status-code-enum";

import { get, post } from "../../common/testTools";
import Config from "../../common/config";
import Models from "../../common/models";

describe("POST /dev/seed/fresh-user/", () => {
    it("seeds one fresh user with the default pattern", async () => {
        const response = await post("/dev/seed/fresh-user/").send({}).expect(StatusCode.SuccessOK);

        const json = JSON.parse(response.text);
        expect(json.users).toHaveLength(1);

        const [seeded] = json.users;
        expect(seeded.user).toMatchObject({
            userId: "githubseed0001",
            name: "Dev Seed seed0001",
            email: "githubseed0001@example.com",
        });
        expect(seeded.jwt).toEqual(expect.any(String));

        const storedUser = await Models.UserInfo.findOne({ userId: "githubseed0001" });
        expect(storedUser).not.toBeNull();

        const storedAuth = await Models.AuthInfo.findOne({ userId: "githubseed0001" });
        expect(storedAuth).toMatchObject({ provider: "github", roles: ["USER"] });
    });

    it("seeds N users with the pattern when count is given", async () => {
        const response = await post("/dev/seed/fresh-user/").send({ count: 3 }).expect(StatusCode.SuccessOK);

        const json = JSON.parse(response.text);
        expect(json.users).toHaveLength(3);
        expect(json.users.map((entry: { user: { userId: string } }) => entry.user.userId)).toEqual([
            "githubseed0001",
            "githubseed0002",
            "githubseed0003",
        ]);
    });

    it("is idempotent across reruns", async () => {
        await post("/dev/seed/fresh-user/").send({ count: 2 }).expect(StatusCode.SuccessOK);
        await post("/dev/seed/fresh-user/").send({ count: 2 }).expect(StatusCode.SuccessOK);

        const count = await Models.UserInfo.countDocuments({ userId: /^githubseed/ });
        expect(count).toBe(2);
    });

    it("clears downstream data so the user is fresh", async () => {
        await Models.RegistrationApplicationDraft.create({ userId: "githubseed0001", firstName: "Stale" });
        await Models.AdmissionDecision.create({ userId: "githubseed0001", status: "ACCEPTED" });
        await Models.AttendeeProfile.create({
            userId: "githubseed0001",
            displayName: "Stale",
            avatarUrl: "https://example.com/a.png",
            discordTag: "stale",
            points: 10,
            pointsAccumulated: 10,
            foodWave: 1,
            dietaryRestrictions: [],
            shirtSize: "M",
            team: "Red",
            teamBadge: "red.png",
        });

        await post("/dev/seed/fresh-user/").send({}).expect(StatusCode.SuccessOK);

        expect(await Models.RegistrationApplicationDraft.findOne({ userId: "githubseed0001" })).toBeNull();
        expect(await Models.AdmissionDecision.findOne({ userId: "githubseed0001" })).toBeNull();
        expect(await Models.AttendeeProfile.findOne({ userId: "githubseed0001" })).toBeNull();
        expect(await Models.RegistrationApplicationSubmitted.findOne({ userId: "githubseed0001" })).toBeNull();
    });

    it("returns 403 when in production", async () => {
        const original = Config.PROD;
        (Config as unknown as { PROD: boolean }).PROD = true;

        try {
            const response = await post("/dev/seed/fresh-user/").send({}).expect(StatusCode.ClientErrorForbidden);
            expect(JSON.parse(response.text)).toHaveProperty("error", "DevDisabled");
        } finally {
            (Config as unknown as { PROD: boolean }).PROD = original;
        }
    });
});

describe("GET /dev/users/", () => {
    beforeEach(async () => {
        await post("/dev/seed/fresh-user/").send({ count: 2 }).expect(StatusCode.SuccessOK);
    });

    it("lists seeded users for the picker", async () => {
        const response = await get("/dev/users/").expect(StatusCode.SuccessOK);

        const json = JSON.parse(response.text);
        expect(json.users.map((user: { userId: string }) => user.userId)).toEqual(["githubseed0001", "githubseed0002"]);
    });

    it("seeded jwt passes auth and has nothing completed", async () => {
        const seedResponse = await post("/dev/seed/fresh-user/").send({ count: 1 }).expect(StatusCode.SuccessOK);
        const jwt = JSON.parse(seedResponse.text).users[0].jwt as string;

        const userResponse = await get("/user/").set("Authorization", jwt).expect(StatusCode.SuccessOK);
        expect(JSON.parse(userResponse.text)).toMatchObject({ userId: "githubseed0001" });

        await get("/registration/").set("Authorization", jwt).expect(StatusCode.ClientErrorNotFound);
    });

    it("returns 403 when in production", async () => {
        const original = Config.PROD;
        (Config as unknown as { PROD: boolean }).PROD = true;

        try {
            const response = await get("/dev/users/").expect(StatusCode.ClientErrorForbidden);
            expect(JSON.parse(response.text)).toHaveProperty("error", "DevDisabled");
        } finally {
            (Config as unknown as { PROD: boolean }).PROD = original;
        }
    });
});
