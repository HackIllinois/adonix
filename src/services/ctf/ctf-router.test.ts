import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { postAsAdmin, getAsStaff, delAsAdmin, postAsUser } from "../../common/testTools";
import Models from "../../common/models";
import { StatusCode } from "status-code-enum";
import { Flag, FlagCreateRequest } from "./ctf-schemas";
import { TESTER } from "../../common/testTools";
import { AttendeeProfile } from "../profile/profile-schemas";

const TEST_FLAG_1 = {
    flagId: "flag1",
    flag: "hackctf{flag1-example_flag}",
    points: 10,
} satisfies Flag;

const TEST_FLAG_2 = {
    flagId: "flag2",
    flag: "hackctf{flag2-example_flag}",
    points: 20,
} satisfies Flag;

const TEST_FLAG_REQUEST = {
    flagId: "flag1",
    flag: "hackctf{flag1-example_flag}",
    points: 10,
} satisfies FlagCreateRequest;

const TESTER_PROFILE = {
    userId: TESTER.id,
    displayName: "TestDisplayName",
    avatarUrl: TESTER.avatarUrl,
    discordTag: "TestTag",
    points: 0,
    pointsAccumulated: 0,
    foodWave: 0,
    dietaryRestrictions: ["Vegetarian", "Peanut Allergy"],
    shirtSize: "M",
    team: "TestTeam",
    teamBadge: "https://test-badge.png",
} satisfies AttendeeProfile;

describe("POST /ctf/", () => {
    it("successfully creates new flag", async () => {
        const response = await postAsAdmin("/ctf/").send(TEST_FLAG_REQUEST).expect(StatusCode.SuccessCreated);
        const data = JSON.parse(response.text);
        expect(data).toMatchObject(TEST_FLAG_1);

        const stored = await Models.Flag.findOne({ flagId: data.flagId });
        expect(stored?.toObject()).toMatchObject(TEST_FLAG_1);
    });
});

describe("GET /ctf/", () => {
    it("returns an empty list when no flags exist", async () => {
        const response = await getAsStaff("/ctf/").expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toEqual([]);
    });

    it("returns all existing flags", async () => {
        await Models.Flag.create(TEST_FLAG_1);
        await Models.Flag.create(TEST_FLAG_2);

        const response = await getAsStaff("/ctf/").expect(StatusCode.SuccessOK);
        const data = JSON.parse(response.text);

        expect(data.length).toEqual(2);
        expect(data).toMatchObject([TEST_FLAG_1, TEST_FLAG_2]);
    });
});

describe("DELETE /ctf/:id/", () => {
    it("returns 404 for non-existent flag", async () => {
        const response = await delAsAdmin("/ctf/invalidId/").expect(StatusCode.ClientErrorNotFound);
        expect(JSON.parse(response.text)).toMatchObject({
            error: "FlagNotFound",
            message: "Failed to find flag",
        });
    });

    it("deletes an existing flag successfully", async () => {
        const createdFlag = await Models.Flag.create(TEST_FLAG_1);
        await delAsAdmin(`/ctf/${createdFlag.flagId}/`).expect(StatusCode.SuccessNoContent);

        const deleted = await Models.Flag.findOne({ flagId: createdFlag.flagId });
        expect(deleted).toBeNull();
    });
});

describe("POST /ctf/submit/:id/", () => {
    beforeEach(async () => {
        await Models.Flag.deleteMany({});
        await Models.FlagsClaimed.deleteMany({});
        await Models.AttendeeProfile.deleteMany({});
        await Models.Flag.create(TEST_FLAG_1);
        await Models.AttendeeProfile.create(TESTER_PROFILE);
    });

    it("errors for incorrect flag submission", async () => {
        const response = await postAsUser(`/ctf/submit/${TEST_FLAG_1.flagId}/`)
            .send({ answer: "wrong_answer" })
            .expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toMatchObject({
            error: "CTFSolveFailed",
            message: "The submitted flag is incorrect",
        });
    });

    it("errors for already claimed flag", async () => {
        await Models.FlagsClaimed.create({ userId: TESTER_PROFILE.userId, flagId: TEST_FLAG_1.flagId });
        await postAsUser(`/ctf/submit/${TEST_FLAG_1.flagId}/`)
            .send({ answer: TEST_FLAG_1.flag })
            .expect(StatusCode.ClientErrorBadRequest);

        const profile = await Models.AttendeeProfile.findOne({ userId: TESTER_PROFILE.userId });
        expect(profile!.points).toEqual(TESTER_PROFILE.points);
    });

    it("logs correct flag submission and awards points", async () => {
        jest.useFakeTimers({ advanceTimers: true }).setSystemTime(new Date("2026-02-28T13:30:00-06:00"));

        await postAsUser(`/ctf/submit/${TEST_FLAG_1.flagId}/`).send({ answer: TEST_FLAG_1.flag }).expect(StatusCode.SuccessOK);

        const updatedProfile = await Models.AttendeeProfile.findOne({ userId: TESTER_PROFILE.userId });
        expect(updatedProfile!.points).toEqual(TESTER_PROFILE.points + TEST_FLAG_1.points);

        const claim = await Models.FlagsClaimed.findOne({ userId: TESTER_PROFILE.userId, flagId: TEST_FLAG_1.flagId });
        expect(claim).not.toBeNull();

        jest.useRealTimers();
    });

    it("errors when CTF has not started yet", async () => {
        jest.useFakeTimers({ advanceTimers: true }).setSystemTime(new Date("2026-02-28T12:59:59-06:00"));

        const response = await postAsUser(`/ctf/submit/${TEST_FLAG_1.flagId}/`)
            .send({ answer: TEST_FLAG_1.flag })
            .expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toMatchObject({
            error: "CTFNotActive",
            message: "CTF is not currently active",
        });

        jest.useRealTimers();
    });

    it("errors when CTF has already ended", async () => {
        jest.useFakeTimers({ advanceTimers: true }).setSystemTime(new Date("2026-02-28T14:00:01-06:00"));

        const response = await postAsUser(`/ctf/submit/${TEST_FLAG_1.flagId}/`)
            .send({ answer: TEST_FLAG_1.flag })
            .expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toMatchObject({
            error: "CTFNotActive",
            message: "CTF is not currently active",
        });

        jest.useRealTimers();
    });

    it("awards points when submitted during the active window", async () => {
        jest.useFakeTimers({ advanceTimers: true }).setSystemTime(new Date("2026-02-28T13:30:00-06:00"));

        await postAsUser(`/ctf/submit/${TEST_FLAG_1.flagId}/`).send({ answer: TEST_FLAG_1.flag }).expect(StatusCode.SuccessOK);

        const updatedProfile = await Models.AttendeeProfile.findOne({ userId: TESTER_PROFILE.userId });
        expect(updatedProfile!.points).toEqual(TESTER_PROFILE.points + TEST_FLAG_1.points);

        jest.useRealTimers();
    });
});
