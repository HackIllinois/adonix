import { beforeEach, describe, expect, it } from "@jest/globals";
import { StatusCode } from "status-code-enum";
import Config from "../../common/config";
import { AttendeeProfile, AttendeeProfileCreateRequest, AttendeeProfileUpdateRequest } from "./profile-schemas";
import Models from "../../common/models";
import { TESTER, getAsAdmin, getAsAttendee, getAsUser, postAsAttendee, putAsAttendee } from "../../common/testTools";
import { RegistrationApplicationSubmitted } from "../registration/registration-schemas";

const TESTER_USER = {
    userId: TESTER.id,
    displayName: TESTER.name,
    avatarUrl: TESTER.avatarUrl,
    discordTag: TESTER.discordTag,
    points: 0,
    pointsAccumulated: 0,
    foodWave: 1,
    dietaryRestrictions: ["Peanut Allergy"],
} satisfies AttendeeProfile;

const TESTER_USER_2 = {
    userId: "tester2",
    displayName: TESTER.name + "2",
    avatarUrl: TESTER.avatarUrl,
    discordTag: TESTER.discordTag,
    points: 12,
    pointsAccumulated: 12,
    foodWave: 2,
    dietaryRestrictions: [],
} satisfies AttendeeProfile;

const TESTER_USER_3 = {
    userId: "tester3",
    displayName: TESTER.name + "3",
    avatarUrl: TESTER.avatarUrl,
    discordTag: TESTER.discordTag,
    points: 12,
    pointsAccumulated: 12,
    foodWave: 2,
    dietaryRestrictions: [],
} satisfies AttendeeProfile;

const CREATE_REQUEST = {
    avatarId: TESTER.avatarId,
    displayName: TESTER.name,
    discordTag: TESTER.discordTag,
    dietaryRestrictions: ["Peanut Allergy"],
} satisfies AttendeeProfileCreateRequest;

const UPDATE_REQUEST = {
    avatarId: "new avatar",
    displayName: "new name",
    discordTag: "new tag",
} satisfies AttendeeProfileUpdateRequest;

const PROFILE = {
    userId: TESTER.id,
    displayName: CREATE_REQUEST.displayName,
    avatarUrl: TESTER.avatarUrl,
    discordTag: CREATE_REQUEST.discordTag,
    points: 0,
    pointsAccumulated: 0,
    foodWave: 1,
    dietaryRestrictions: ["Peanut Allergy"],
} satisfies AttendeeProfile;

const UPDATED_PROFILE = {
    ...PROFILE,
    displayName: UPDATE_REQUEST.displayName,
    discordTag: UPDATE_REQUEST.discordTag,
    avatarUrl: `https://raw.githubusercontent.com/HackIllinois/adonix-metadata/main/avatars/${UPDATE_REQUEST.avatarId}.png`,
} satisfies AttendeeProfile;

const REGISTRATION = {
    userId: TESTER.id,
    firstName: TESTER.name,
    lastName: TESTER.name,
    age: "21",
    email: TESTER.email,
    gender: "Other",
    race: ["Prefer Not to Answer"],
    country: "United States",
    state: "Illinois",
    school: "University of Illinois Urbana-Champaign",
    education: "Undergraduate University (3+ year)",
    graduate: "Spring 2026",
    major: "Computer Science",
    underrepresented: "No",
    hackathonsParticipated: "2-3",
    application1: "I love hack",
    application2: "I love hack",
    applicationOptional: "optional essay",
    applicationPro: "I wanna be a Pro",
    attribution: "Word of Mouth",
    eventInterest: "Meeting New People",
    requestTravelReimbursement: false,
} satisfies RegistrationApplicationSubmitted;

beforeEach(async () => {
    await Models.AttendeeProfile.create(TESTER_USER);
    await Models.AttendeeProfile.create(TESTER_USER_2);
    await Models.AttendeeProfile.create(TESTER_USER_3);
    await Models.RegistrationApplicationSubmitted.create(REGISTRATION);
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

describe("PUT /profile", () => {
    it("works", async () => {
        const response = await putAsAttendee("/profile/").send(UPDATE_REQUEST).expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject(UPDATED_PROFILE);

        const stored = await Models.AttendeeProfile.findOne({ userId: TESTER_USER.userId });
        expect(stored?.toObject()).toMatchObject(UPDATED_PROFILE);
    });

    it("works for an partial update", async () => {
        const response = await putAsAttendee("/profile/")
            .send({
                discordTag: UPDATE_REQUEST.discordTag,
            } satisfies AttendeeProfileUpdateRequest)
            .expect(StatusCode.SuccessOK);

        const PARTIALLY_UPDATED_PROFILE = {
            ...PROFILE,
            discordTag: UPDATE_REQUEST.discordTag,
        } satisfies AttendeeProfile;

        expect(JSON.parse(response.text)).toMatchObject(PARTIALLY_UPDATED_PROFILE);

        const stored = await Models.AttendeeProfile.findOne({ userId: TESTER_USER.userId });
        expect(stored?.toObject()).toMatchObject(PARTIALLY_UPDATED_PROFILE);
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
                points: 30 - i,
                pointsAccumulated: 30 + i,
                foodWave: 1,
                dietaryRestrictions: [],
            } satisfies AttendeeProfile);
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
