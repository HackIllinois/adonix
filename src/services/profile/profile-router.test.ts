import { beforeEach, describe, expect, it } from "@jest/globals";
import { AttendeeMetadata, AttendeeProfile } from "database/attendee-db.js";
import { StatusCode } from "status-code-enum";
import Config from "../../config.js";
import Models from "../../database/models.js";
import { TESTER, delAsUser, getAsAdmin, getAsUser, postAsAttendee, postAsStaff, postAsUser } from "../../testTools.js";

const TESTER_USER = {
    userId: TESTER.id,
    displayName: TESTER.name,
    avatarUrl: TESTER.avatarUrl,
    discordTag: TESTER.discordTag,
    points: 0,
    coins: 0,
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
    coins: 12,
} satisfies AttendeeProfile;

const TESTER_USER_3 = {
    userId: "tester3",
    displayName: TESTER.name + "3",
    avatarUrl: TESTER.avatarUrl,
    discordTag: TESTER.discordTag,
    points: 12,
    coins: 12,
} satisfies AttendeeProfile;

const profile: AttendeeProfile = {
    userId: TESTER.id,
    displayName: TESTER.name,
    avatarUrl: TESTER.avatarUrl,
    discordTag: TESTER.discordTag,
    points: 0,
    coins: 0,
};

beforeEach(async () => {
    await Models.AttendeeProfile.create(TESTER_USER);
    await Models.AttendeeMetadata.create(TESTER_METADATA);
    await Models.AttendeeProfile.create(TESTER_USER_2);
    await Models.AttendeeProfile.create(TESTER_USER_3);
});

describe("POST /profile", () => {
    it("works for an attendee", async () => {
        await Models.AttendeeProfile.deleteOne({ userId: TESTER_USER.userId });
        const response = await postAsAttendee("/profile/").send(profile).expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toHaveProperty("displayName", TESTER.name);
    });

    it("fails when a profile is already created", async () => {
        await Models.AttendeeProfile.deleteOne({ userId: TESTER_USER.userId });
        const response = await postAsUser("/profile/").send(profile).expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toHaveProperty("displayName", TESTER.name);

        // to verify they can't double create
        const response2 = await postAsUser("/profile/").send(profile).expect(StatusCode.ClientErrorBadRequest);
        expect(JSON.parse(response2.text)).toHaveProperty("error", "UserAlreadyExists");
    });

    it("fails when invalid data is provided", async () => {
        const response = await postAsUser("/profile/")
            .send({
                displayName: 123,
                avatarId: 1,
                discordTag: "test",
            })
            .expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "InvalidParams");
    });
});

describe("GET /profile", () => {
    it("fails to get a profile that doesn't exist", async () => {
        await Models.AttendeeProfile.deleteOne({ userId: TESTER_USER.userId });

        const response = await getAsUser("/profile/").expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "UserNotFound");
    });

    it("gets a profile that exists", async () => {
        const response = await getAsUser("/profile/").expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toHaveProperty("displayName", TESTER.name);
    });
});

describe("GET /profile/userid/:USERID", () => {
    it("fails to get a profile as a user", async () => {
        const response = await getAsUser("/profile/userid/" + TESTER.id).expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("gets a profile as an admin", async () => {
        const response = await getAsAdmin("/profile/userid/" + TESTER.id).expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toHaveProperty("displayName", TESTER.name);
    });

    it("gets a user that doesnt exist", async () => {
        const response = await getAsAdmin("/profile/userid/doesnotexist").expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "UserNotFound");
    });
});

describe("DELETE /profile/", () => {
    it("fails to delete a profile that doesn't exist", async () => {
        await Models.AttendeeProfile.deleteOne({ userId: TESTER_USER.userId });
        const response = await delAsUser("/profile").expect(StatusCode.ClientErrorNotFound);
        expect(JSON.parse(response.text)).toHaveProperty("error", "AttendeeNotFound");
    });

    it("deletes a profile", async () => {
        const response = await delAsUser("/profile").expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toHaveProperty("success", true);
    });
});

describe("GET /profile/leaderboard", () => {
    it("gets 3 entries when no limit is set", async () => {
        await getAsUser("/profile/leaderboard").expect(StatusCode.SuccessOK);
    });

    it("gets with a limit of 2", async () => {
        const response = await getAsUser("/profile/leaderboard?limit=2").expect(StatusCode.SuccessOK);

        const responseArray = JSON.parse(response.text);
        expect(responseArray.profiles.length).toBeLessThan(3);
    });

    it("only gets the max limit when no limit is set", async () => {
        for (let i = 0; i < Config.LEADERBOARD_QUERY_LIMIT + 15; i++) {
            await Models.AttendeeProfile.create({
                userId: TESTER.id + " " + i,
                displayName: TESTER.name + " " + i,
                avatarUrl: TESTER.avatarUrl,
                discordTag: TESTER.discordTag,
                points: i,
                coins: i,
            });
        }

        const response = await getAsUser("/profile/leaderboard").expect(StatusCode.SuccessOK);
        const responseArray = JSON.parse(response.text);

        expect(responseArray.profiles.length).toBeLessThan(Config.LEADERBOARD_QUERY_LIMIT + 1);
    });

    it("fails when an invalid limit is set", async () => {
        const response = await getAsUser("/profile/leaderboard?limit=0").expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "InvalidLimit");
    });
});

describe("GET /profile/addpoints", () => {
    it("works for Staff", async () => {
        const response = await postAsStaff("/profile/addpoints")
            .send({
                userId: TESTER.id,
                points: 10,
            })
            .expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toHaveProperty("points", 10);
    });

    it("returns Forbidden error for users", async () => {
        const response = await postAsUser("/profile/addpoints")
            .send({
                userId: TESTER.id,
                points: 10,
            })
            .expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("returns UserNotFound for nonexistent users", async () => {
        const response = await postAsStaff("/profile/addpoints")
            .send({
                userId: "idontexists",
                points: 10,
            })
            .expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "UserNotFound");
    });
});
