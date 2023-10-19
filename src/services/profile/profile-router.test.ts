import { describe, expect, it, beforeEach } from "@jest/globals";
import Models from "../../database/models.js";
import { TESTER, del, delAsUser, get, getAsAdmin, getAsUser, post, postAsAttendee, postAsUser } from "../../testTools.js";
import { ProfileFormat } from "./profile-formats.js";

beforeEach(async () => {
    Models.initialize();
});

const profile: ProfileFormat = {
    userId: TESTER.id,
    displayName: TESTER.name,
    avatarUrl: TESTER.avatarUrl,
    discordTag: TESTER.discordTag,
    points: 0,
};

describe("POST /profile", () => {
    it("posts with an unauthorized user", async () => {
        const response = await post("/profile/").send(profile).expect(401);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NoToken");
    });

    it("posts for an attendee", async () => {
        const response = await postAsAttendee("/profile/").send(profile).expect(200);

        expect(JSON.parse(response.text)).toHaveProperty("displayName", TESTER.name);
    });

    it("posts for a user", async () => {
        const response = await postAsUser("/profile/").send(profile).expect(200);

        expect(JSON.parse(response.text)).toHaveProperty("displayName", TESTER.name);

        // to verify they can't double create
        const response2 = await postAsUser("/profile/").send(profile).expect(400);
        expect(JSON.parse(response2.text)).toHaveProperty("error", "UserAlreadyExists");
    });
});

describe("GET /profile", () => {
    it("gets with an invalid attendee", async () => {
        const response = await get("/profile").expect(401);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NoToken");
    });

    it("gets with an attendee that doesn't exist", async () => {
        const response = await getAsUser("/profile/").expect(404);

        expect(JSON.parse(response.text)).toHaveProperty("error", "UserNotFound");
    });

    it("gets an attendee that exists", async () => {
        await Models.AttendeeProfile.create({
            userId: TESTER.id,
            displayName: TESTER.name,
            avatarUrl: TESTER.avatarUrl,
            discordTag: TESTER.discordTag,
            points: 0,
        });

        const response = await getAsUser("/profile/").expect(200);
        expect(JSON.parse(response.text)).toHaveProperty("displayName", TESTER.name);
    });
});

describe("GET /profile/id/:USERID", () => {
    it("gets with an invalid user", async () => {
        await Models.AttendeeProfile.create({
            userId: "abcdefgabcdefgaaa",
            displayName: "tst",
            avatarUrl: TESTER.avatarUrl,
            discordTag: TESTER.discordTag,
            points: 0,
        });

        const response = await get("/profile/id/abcdefgabcdefgaaa").expect(401);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NoToken");
    });

    it("gets with a user", async () => {
        await Models.AttendeeProfile.create({
            userId: "abcdefgabcdefgaaa",
            displayName: "tst",
            avatarUrl: TESTER.avatarUrl,
            discordTag: TESTER.discordTag,
            points: 0,
        });

        const response = await getAsUser("/profile/id/abcdefgabcdefgaaa").expect(403);

        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("gets with an admin", async () => {
        await Models.AttendeeProfile.create({
            userId: "abcdefgabcdefgaaa",
            displayName: "tst",
            avatarUrl: TESTER.avatarUrl,
            discordTag: TESTER.discordTag,
            points: 0,
        });

        const response = await getAsAdmin("/profile/id/abcdefgabcdefgaaa").expect(200);

        expect(JSON.parse(response.text)).toHaveProperty("displayName", "tst");
    });

    it("gets a user that doesnt exist", async () => {
        await Models.AttendeeProfile.create({
            userId: "abcdefgabcdefgaaa",
            displayName: "tst",
            avatarUrl: TESTER.avatarUrl,
            discordTag: TESTER.discordTag,
            points: 0,
        });

        const response = await getAsAdmin("/profile/id/doesnotexist").expect(404);

        expect(JSON.parse(response.text)).toHaveProperty("error", "UserNotFound");
    });
});

describe("DELETE /profile/", () => {
    it("delete with an invalid user", async () => {
        const response = await del("/profile").expect(401);
        expect(JSON.parse(response.text)).toHaveProperty("error", "NoToken");
    });

    it("delete with a user that doesn't exist", async () => {
        const response = await delAsUser("/profile").expect(404);
        expect(JSON.parse(response.text)).toHaveProperty("error", "AttendeeNotFound");
    });

    it("delete with a valid user", async () => {
        await Models.AttendeeProfile.create({
            userId: TESTER.id,
            displayName: TESTER.name,
            avatarUrl: TESTER.avatarUrl,
            discordTag: TESTER.discordTag,
            points: 0,
        });

        await Models.AttendeeMetadata.create({
            userId: TESTER.id,
            foodWave: 0,
        });

        const response = await delAsUser("/profile").expect(200);
        expect(JSON.parse(response.text)).toHaveProperty("success", true);
    });
});
