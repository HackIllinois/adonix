import { beforeEach, describe, expect, it } from "@jest/globals";
import { StatusCode } from "status-code-enum";
import Config from "../../common/config";
import { AttendeeProfile, AttendeeProfileCreateRequest } from "./profile-schemas";
import Models from "../../common/models";
import { TESTER, getAsAdmin, getAsAttendee, getAsUser, postAsAttendee, postAsStaff, postAsUser } from "../../common/testTools";
import { Degree, Gender, HackInterest, HackOutreach, Race, RegistrationApplication } from "../registration/registration-schemas";

const TESTER_USER = {
    userId: TESTER.id,
    displayName: TESTER.name,
    avatarUrl: TESTER.avatarUrl,
    discordTag: TESTER.discordTag,
    points: 0,
    foodWave: 1,
} satisfies AttendeeProfile;

const TESTER_USER_2 = {
    userId: "tester2",
    displayName: TESTER.name + "2",
    avatarUrl: TESTER.avatarUrl,
    discordTag: TESTER.discordTag,
    points: 12,
    foodWave: 2,
} satisfies AttendeeProfile;

const TESTER_USER_3 = {
    userId: "tester3",
    displayName: TESTER.name + "3",
    avatarUrl: TESTER.avatarUrl,
    discordTag: TESTER.discordTag,
    points: 12,
    foodWave: 2,
} satisfies AttendeeProfile;

const CREATE_REQUEST = {
    avatarId: TESTER.avatarId,
    displayName: TESTER.name,
    discordTag: TESTER.discordTag,
} satisfies AttendeeProfileCreateRequest;

const PROFILE = {
    userId: TESTER.id,
    displayName: CREATE_REQUEST.displayName,
    avatarUrl: TESTER.avatarUrl,
    discordTag: CREATE_REQUEST.discordTag,
    points: 0,
    foodWave: 1,
} satisfies AttendeeProfile;

const REGISTRATION = {
    userId: TESTER.id,
    hasSubmitted: true,
    preferredName: TESTER.name,
    legalName: TESTER.name,
    emailAddress: TESTER.email,
    university: "ap",
    hackEssay1: "ap",
    hackEssay2: "ap",
    optionalEssay: "ap",
    location: "ap",
    gender: Gender.OTHER,
    degree: Degree.BACHELORS,
    major: "CS",
    gradYear: 0,
    requestedTravelReimbursement: false,
    dietaryRestrictions: ["some restriction"],
    race: [Race.NO_ANSWER],
    hackInterest: [HackInterest.TECHNICAL_WORKSHOPS],
    hackOutreach: [HackOutreach.INSTAGRAM],
} satisfies RegistrationApplication;

beforeEach(async () => {
    await Models.AttendeeProfile.create(TESTER_USER);
    await Models.AttendeeProfile.create(TESTER_USER_2);
    await Models.AttendeeProfile.create(TESTER_USER_3);
    await Models.RegistrationApplication.create(REGISTRATION);
});

describe("POST /profile", () => {
    it("works for an attendee", async () => {
        await Models.AttendeeProfile.deleteOne({ userId: TESTER_USER.userId });
        const response = await postAsAttendee("/profile/").send(CREATE_REQUEST).expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toHaveProperty("displayName", TESTER.name);

        const stored = await Models.AttendeeProfile.findOne({ userId: TESTER_USER.userId });
        expect(stored?.toObject()).toMatchObject(PROFILE);
    });

    it("fails when a profile is already created", async () => {
        await Models.AttendeeProfile.deleteOne({ userId: TESTER_USER.userId });
        const response = await postAsAttendee("/profile/").send(CREATE_REQUEST).expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject(PROFILE);

        const stored = await Models.AttendeeProfile.findOne({ userId: TESTER_USER.userId });
        expect(stored?.toObject()).toMatchObject(PROFILE);

        // to verify they can't double create
        const response2 = await postAsAttendee("/profile/").send(CREATE_REQUEST).expect(StatusCode.ClientErrorBadRequest);
        expect(JSON.parse(response2.text)).toHaveProperty("error", "AlreadyExists");
    });

    it("fails when invalid data is provided", async () => {
        const response = await postAsAttendee("/profile/")
            .send({
                displayName: 123,
                avatarId: 1,
                discordTag: "test",
            })
            .expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "BadRequest");
    });
});

describe("GET /profile", () => {
    it("fails to get a profile that doesn't exist", async () => {
        await Models.AttendeeProfile.deleteOne({ userId: TESTER_USER.userId });

        const response = await getAsAttendee("/profile/").expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NotFound");
    });

    it("gets a profile that exists", async () => {
        const response = await getAsAttendee("/profile/").expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject(PROFILE);
    });
});

describe("GET /profile/:id/", () => {
    it("fails to get a profile as a attendee", async () => {
        const response = await getAsAttendee(`/profile/${TESTER.id}`).expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("gets a profile as an admin", async () => {
        const response = await getAsAdmin(`/profile/${TESTER.id}`).expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toHaveProperty("displayName", TESTER.name);
    });

    it("gets a user that doesnt exist", async () => {
        const response = await getAsAdmin("/profile/doesnotexist").expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NotFound");
    });
});

describe("GET /profile/leaderboard", () => {
    it("gets 3 entries when no limit is set", async () => {
        const response = await getAsUser("/profile/leaderboard").expect(StatusCode.SuccessOK);
        const parsed = JSON.parse(response.text);
        expect(parsed.profiles.length).toBe(3);
    });

    it("gets with a limit of 2", async () => {
        const response = await getAsUser("/profile/leaderboard?limit=2").expect(StatusCode.SuccessOK);

        const parsed = JSON.parse(response.text);
        expect(parsed.profiles.length).toBe(2);
    });

    it("only gets the max limit when no limit is set", async () => {
        for (let i = 0; i < Config.LEADERBOARD_QUERY_LIMIT + 15; i++) {
            await Models.AttendeeProfile.create({
                userId: TESTER.id + " " + i,
                displayName: TESTER.name + " " + i,
                avatarUrl: TESTER.avatarUrl,
                discordTag: TESTER.discordTag,
                points: i,
                foodWave: 1,
            });
        }

        const response = await getAsUser("/profile/leaderboard").expect(StatusCode.SuccessOK);
        const responseArray = JSON.parse(response.text);

        expect(responseArray.profiles.length).toBe(Config.LEADERBOARD_QUERY_LIMIT);
    });

    it("fails when an invalid limit is set", async () => {
        const response = await getAsUser("/profile/leaderboard?limit=0").expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "BadRequest");
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

    it("returns NotFound for nonexistent users", async () => {
        const response = await postAsStaff("/profile/addpoints")
            .send({
                userId: "idontexists",
                points: 10,
            })
            .expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NotFound");
    });
});
