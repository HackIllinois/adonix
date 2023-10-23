import { describe, expect, it, beforeEach } from "@jest/globals";
import Models from "../../database/models.js";
import { TESTER, delAsUser, getAsAdmin, getAsUser, postAsAttendee, postAsUser } from "../../testTools.js";
import { ProfileFormat } from "./profile-formats.js";
import Constants from "../../constants.js";
import { AttendeeMetadata, AttendeeProfile } from "database/attendee-db.js";

beforeEach(async () => {
    Models.initialize();

});

const TESTER_USER = {
    userId: TESTER.id,
    displayName: TESTER.name,
    avatarUrl: TESTER.avatarUrl,
    discordTag: TESTER.discordTag,
    points: 0,
} satisfies AttendeeProfile;

const TESTER_METADATA = {
    userId: TESTER.id,
    foodWave: 0,
} satisfies AttendeeMetadata;

const TESTER_USER_2 = {
    userId: "tester2",
    displayName: TESTER.name + "2",
    avatarUrl: TESTER.avatarUrl,
    discordTag: TESTER.discordTag,
    points: 12,
} satisfies AttendeeProfile;

const TESTER_USER_3 = {
    userId: "tester3",
    displayName: TESTER.name + "3",
    avatarUrl: TESTER.avatarUrl,
    discordTag: TESTER.discordTag,
    points: 12,
} satisfies AttendeeProfile;

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
    it("fails to get a profile that doesn't exist", async () => {
        const response = await getAsUser("/profile/").expect(404);

        expect(JSON.parse(response.text)).toHaveProperty("error", "UserNotFound");
    });

    it("gets a profile that exists", async () => {
        await Models.AttendeeProfile.create(TESTER_USER);

        const response = await getAsUser("/profile/").expect(200);
        expect(JSON.parse(response.text)).toHaveProperty("displayName", TESTER.name);
    });
});

describe("GET /profile/id/:USERID", () => {
    it("fails with no id provided", async () => {

        await getAsUser("/profile/id").expect(302);
    });

    it("fails to get a profile as a user", async () => {
        await Models.AttendeeProfile.create(TESTER_USER);

        const response = await getAsUser("/profile/id/"+TESTER.id).expect(403);

        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("gets with an admin", async () => {
        await Models.AttendeeProfile.create(TESTER_USER);

        const response = await getAsAdmin("/profile/id/"+TESTER.id).expect(200);

        expect(JSON.parse(response.text)).toHaveProperty("displayName", TESTER.name);
    });

    it("gets a user that doesnt exist", async () => {
        await Models.AttendeeProfile.create(TESTER_USER);

        const response = await getAsAdmin("/profile/id/doesnotexist").expect(404);

        expect(JSON.parse(response.text)).toHaveProperty("error", "UserNotFound");
    });
});

describe("DELETE /profile/", () => {
    it("fails to delete a profile that doesn't exist", async () => {
        const response = await delAsUser("/profile").expect(404);
        expect(JSON.parse(response.text)).toHaveProperty("error", "AttendeeNotFound");
    });

    it("deletes a profile", async () => {
        await Models.AttendeeProfile.create(TESTER_USER);

        await Models.AttendeeMetadata.create(TESTER_METADATA);

        const response = await delAsUser("/profile").expect(200);
        expect(JSON.parse(response.text)).toHaveProperty("success", true);
    });
});

describe("GET /profile/leaderboard", () => {
    it("gets 3 entries when no limit is set", async () => {

        await Models.AttendeeProfile.create(TESTER_USER);

        await Models.AttendeeProfile.create(TESTER_USER_2);

        await Models.AttendeeProfile.create(TESTER_USER_3);

        await getAsUser("/profile/leaderboard").expect(200);
    });

    it("gets with a limit of 2", async () => {
        await Models.AttendeeProfile.create(TESTER_USER);

        await Models.AttendeeProfile.create(TESTER_USER_2);

        await Models.AttendeeProfile.create(TESTER_USER_3);

        const response = await getAsUser("/profile/leaderboard?limit=2").expect(200);
        
        const responseArray = JSON.parse(response.text);
        expect(responseArray.profiles.length).toBeLessThan(3);
    });

    it("only gets the max limit when no limit is set", async () => {
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

    it("fails when an invalid limit is set", async () => {
        const response = await getAsUser("/profile/leaderboard?limit=0").expect(400);

        expect(JSON.parse(response.text)).toHaveProperty("error", "InvalidLimit");
    });
});
