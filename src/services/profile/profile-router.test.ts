import { describe, expect, it, beforeEach } from "@jest/globals";
import Models from "../../database/models.js";
import { TESTER, delAsUser, getAsAdmin, getAsUser, postAsAttendee, postAsUser } from "../../testTools.js";
import { ProfileFormat } from "./profile-formats.js";
import Constants from "../../constants.js";

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

    it("posts with invalid data", async () => {
        const response = await postAsUser("/profile/")
            .send({
                displayName: 123,
                avatarUrl: 1,
                discordTag: "test",
            })
            .expect(400);

        expect(JSON.parse(response.text)).toHaveProperty("error", "InvalidParams");
    });
});

describe("GET /profile", () => {
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
    it("gets without a :USERID", async () => {
        await Models.AttendeeProfile.create({
            userId: TESTER.id,
            displayName: TESTER.name,
            avatarUrl: TESTER.avatarUrl,
            discordTag: TESTER.discordTag,
            points: 0,
        });

        await getAsUser("/profile/id").expect(302);
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
    it("deletes with a attendee that doesn't exist", async () => {
        const response = await delAsUser("/profile").expect(404);
        expect(JSON.parse(response.text)).toHaveProperty("error", "AttendeeNotFound");
    });

    it("deletes with a valid user", async () => {
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

describe("GET /profile/leaderboard", () => {
    it("gets with no limit but only 3 entries", async () => {
        await Models.AttendeeProfile.create({
            userId: TESTER.id,
            displayName: TESTER.name,
            avatarUrl: TESTER.avatarUrl,
            discordTag: TESTER.discordTag,
            points: 25,
        });

        await Models.AttendeeProfile.create({
            userId: "tester2",
            displayName: TESTER.name + "2",
            avatarUrl: TESTER.avatarUrl,
            discordTag: TESTER.discordTag,
            points: 12,
        });

        await Models.AttendeeProfile.create({
            userId: "tester3",
            displayName: TESTER.name + "3",
            avatarUrl: TESTER.avatarUrl,
            discordTag: TESTER.discordTag,
            points: 27,
        });

        await getAsUser("/profile/leaderboard").expect(200);
    });

    it("gets with a limit of 2", async () => {
        await Models.AttendeeProfile.create({
            userId: TESTER.id,
            displayName: TESTER.name,
            avatarUrl: TESTER.avatarUrl,
            discordTag: TESTER.discordTag,
            points: 25,
        });

        await Models.AttendeeProfile.create({
            userId: "tester2",
            displayName: TESTER.name + "2",
            avatarUrl: TESTER.avatarUrl,
            discordTag: TESTER.discordTag,
            points: 12,
        });

        await Models.AttendeeProfile.create({
            userId: "tester3",
            displayName: TESTER.name + "3",
            avatarUrl: TESTER.avatarUrl,
            discordTag: TESTER.discordTag,
            points: 27,
        });

        await getAsUser("/profile/leaderboard?limit=2").expect(200);
    });

    it("gets with no limit & more entries in db than the max query limit", async () => {
        for (let i = 0; i < Constants.LEADERBOARD_QUERY_LIMIT + 15; i++) {
            await Models.AttendeeProfile.create({
                userId: TESTER.id + " " + i,
                displayName: TESTER.name + " " + i,
                avatarUrl: TESTER.avatarUrl,
                discordTag: TESTER.discordTag,
                points: i,
            });
        }

        const response = await getAsUser("/profile/leaderboard").expect(200);

        const responseArray = JSON.parse(response.text);

        expect(responseArray.profiles.length).toBeLessThan(Constants.LEADERBOARD_QUERY_LIMIT + 1);
    });

    it("gets with an invalid limit", async () => {
        const response = await getAsUser("/profile/leaderboard?limit=0").expect(400);

        expect(JSON.parse(response.text)).toHaveProperty("error", "InvalidLimit");
    });
});
