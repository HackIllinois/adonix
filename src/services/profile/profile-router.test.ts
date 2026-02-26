import { beforeEach, describe, expect, it } from "@jest/globals";
import { StatusCode } from "status-code-enum";
import Config from "../../common/config";
import { AttendeeProfile, AttendeeProfileCreateRequest, AttendeeProfileUpdateRequest } from "./profile-schemas";
import Models from "../../common/models";
import { TESTER, getAsAdmin, getAsAttendee, getAsUser, postAsAttendee, putAsAttendee, putAsStaff } from "../../common/testTools";
import { updatePoints, TIER_1_PTS, TIER_3_PTS } from "./profile-lib";

const TESTER_USER = {
    userId: TESTER.id,
    displayName: TESTER.name,
    avatarUrl: TESTER.avatarUrl,
    discordTag: TESTER.discordTag,
    points: 0,
    pointsAccumulated: 0,
    foodWave: 1,
    dietaryRestrictions: ["Peanut Allergy"],
    shirtSize: "M",
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
    shirtSize: "L",
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
    shirtSize: "S",
} satisfies AttendeeProfile;

const CREATE_REQUEST = {
    avatarId: TESTER.avatarId,
    displayName: TESTER.name,
    discordTag: TESTER.discordTag,
    dietaryRestrictions: ["Peanut Allergy"],
    shirtSize: "M",
} satisfies AttendeeProfileCreateRequest;

const UPDATE_REQUEST = {
    avatarId: "new avatar",
    displayName: "new name",
    discordTag: "new tag",
    shirtSize: "L",
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
    shirtSize: CREATE_REQUEST.shirtSize,
} satisfies AttendeeProfile;

const UPDATED_PROFILE = {
    ...PROFILE,
    displayName: UPDATE_REQUEST.displayName,
    discordTag: UPDATE_REQUEST.discordTag,
    avatarUrl: `https://raw.githubusercontent.com/HackIllinois/adonix-metadata/main/avatars/${UPDATE_REQUEST.avatarId}.png`,
    shirtSize: UPDATE_REQUEST.shirtSize,
} satisfies AttendeeProfile;

beforeEach(async () => {
    await Models.AttendeeProfile.create(TESTER_USER);
    await Models.AttendeeProfile.create(TESTER_USER_2);
    await Models.AttendeeProfile.create(TESTER_USER_3);
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

    it("correctly updates tiers", async () => {
        await getAsAttendee("/profile/").expect(StatusCode.SuccessOK);
        const updatedBronze = await updatePoints(TESTER_USER.userId, TIER_3_PTS);
        expect(updatedBronze!.pointsAccumulated).toEqual(TIER_3_PTS);
        expect(updatedBronze!.tier).toEqual(3);

        const updatedBronzeProfile = await Models.AttendeeProfile.findOne({ userId: TESTER_USER.userId });
        expect(updatedBronzeProfile!.pointsAccumulated).toEqual(TIER_3_PTS);
        expect(updatedBronzeProfile!.tier).toEqual(3);

        const updatedGold = await updatePoints(TESTER_USER.userId, TIER_1_PTS);
        expect(updatedGold!.pointsAccumulated).toEqual(TIER_3_PTS + TIER_1_PTS);
        expect(updatedGold!.tier).toEqual(1);

        const updatedGoldProfile = await Models.AttendeeProfile.findOne({ userId: TESTER_USER.userId });
        expect(updatedGoldProfile!.pointsAccumulated).toEqual(TIER_3_PTS + TIER_1_PTS);
        expect(updatedGoldProfile!.tier).toEqual(1);
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
                shirtSize: "M",
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

describe("PUT /profile/update-tiers", () => {
    it("updates tiers for all attendees", async () => {
        await updatePoints(TESTER_USER.userId, 800);
        await updatePoints(TESTER_USER_2.userId, 400);
        await updatePoints(TESTER_USER_3.userId, 5);

        const newRequestBody = {
            tier1Pts: 900,
            tier2Pts: 500,
            tier3Pts: 100,
        };

        const response = await putAsStaff("/profile/update-tiers/").send(newRequestBody).expect(StatusCode.SuccessOK);
        const modifiedCount = JSON.parse(response.text);
        expect(modifiedCount).toBe(3);

        const profile1After = await Models.AttendeeProfile.findOne({ userId: TESTER_USER.userId });
        expect(profile1After!.tier).toBe(2);
        const profile2After = await Models.AttendeeProfile.findOne({ userId: TESTER_USER_2.userId });
        expect(profile2After!.tier).toBe(3);
        const profile3After = await Models.AttendeeProfile.findOne({ userId: TESTER_USER_3.userId });
        expect(profile3After!.tier).toBeUndefined();
    });
});
