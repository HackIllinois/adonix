import { describe, expect, it } from "@jest/globals";
import { getAsAttendee, postAsAttendee, putAsAttendee, delAsAdmin } from "../../common/testTools";
import { StatusCode } from "status-code-enum";
import Models from "../../common/models";
import { DuelCreateRequest } from "./duel-schemas";
import { TESTER } from "../../common/testTools";
import { AttendeeProfile } from "../profile/profile-schemas";

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
    team: "Team 1",
    duelsPlayed: 0,
    duelsWon: 0,
} satisfies AttendeeProfile;

const TEST_PROFILE_2 = {
    userId: "attendee1",
    displayName: "TestDisplayName",
    avatarUrl: "TestAvatarUrl",
    discordTag: "TestTag",
    points: 0,
    pointsAccumulated: 0,
    foodWave: 0,
    dietaryRestrictions: ["Vegetarian", "Peanut Allergy"],
    shirtSize: "M",
    duelsPlayed: 0,
    duelsWon: 0,
} satisfies AttendeeProfile;

const TEST_DUEL = {
    hostId: TESTER.id,
    guestId: TEST_PROFILE_2.userId,
    hostScore: 0,
    guestScore: 2,
    hostHasDisconnected: false,
    guestHasDisconnected: false,
    hasFinished: false,
    isScoringDuel: true,
    pendingUpdates: { host: [], guest: ['{"hostScore":3}'] },
};

const TEST_DUEL_2 = {
    hostId: TEST_PROFILE_2.userId,
    guestId: TESTER.id,
    hostScore: 0,
    guestScore: 2,
    hostHasDisconnected: false,
    guestHasDisconnected: false,
    hasFinished: false,
    isScoringDuel: false,
    pendingUpdates: { host: ['{"hostScore":1}'], guest: [] },
};

const DISCONNECTED_DUEL = {
    hostId: TEST_PROFILE_2.userId,
    guestId: TESTER.id,
    hostScore: 0,
    guestScore: 2,
    hostHasDisconnected: true,
    guestHasDisconnected: false,
    hasFinished: true,
    isScoringDuel: false,
    pendingUpdates: { host: [], guest: [] },
};

const TEST_DUEL_REQUEST = {
    hostId: "google12345",
    guestId: "google67890",
} satisfies DuelCreateRequest;

describe("POST /duel/", () => {
    it("successfully creates new duel", async () => {
        const response = await postAsAttendee("/duel/").send(TEST_DUEL_REQUEST).expect(StatusCode.SuccessCreated);
        const data = JSON.parse(response.text);

        const stored = await Models.Duel.findById(data._id);
        expect(stored?.toObject()).toMatchObject({
            hostId: TEST_DUEL_REQUEST.hostId,
            guestId: TEST_DUEL_REQUEST.guestId,
            hostScore: 0,
            guestScore: 0,
            hostHasDisconnected: false,
            guestHasDisconnected: false,
            hasFinished: false,
            pendingUpdates: { host: [], guest: [] },
        });
    });

    it("marks first duel as scoring duel", async () => {
        await Models.Duel.create(DISCONNECTED_DUEL);
        const firstResponse = await postAsAttendee("/duel/").send(TEST_DUEL_REQUEST).expect(StatusCode.SuccessCreated);
        const secondResponse = await postAsAttendee("/duel/").send(TEST_DUEL_REQUEST).expect(StatusCode.SuccessCreated);

        const firstDuel = JSON.parse(firstResponse.text);
        const secondDuel = JSON.parse(secondResponse.text);

        expect(firstDuel.isScoringDuel).toBe(true);
        expect(secondDuel.isScoringDuel).toBe(false);
    });
});

describe("GET /duel/:id/", () => {
    it("returns existing duel", async () => {
        const createdDuel = await Models.Duel.create(TEST_DUEL);

        const response = await getAsAttendee(`/duel/${createdDuel.id}/`).expect(StatusCode.SuccessOK);
        const data = JSON.parse(response.text);

        expect(data).toMatchObject(TEST_DUEL);
    });

    it("errors for non-existing duel", async () => {
        await getAsAttendee(`/duel/invalid/`).expect(StatusCode.ClientErrorNotFound);
    });
});

describe("PUT /duel/:id/", () => {
    it("first call adds pending update", async () => {
        const createdDuel = await Models.Duel.create(TEST_DUEL);

        await putAsAttendee(`/duel/${createdDuel.id}/`)
            .send({
                hostScore: 1,
            })
            .expect(StatusCode.SuccessAccepted);

        const pendingDuel = await Models.Duel.findById(createdDuel.id);
        expect(pendingDuel!.hostScore).toBe(0);
        expect(pendingDuel!.pendingUpdates.host).toHaveLength(1);
    });

    it("second call applies pending update", async () => {
        const createdDuel = await Models.Duel.create(TEST_DUEL_2);

        await putAsAttendee(`/duel/${createdDuel.id}/`)
            .send({
                hostScore: 1,
            })
            .expect(StatusCode.SuccessOK);
        const updatedDuel = await Models.Duel.findById(createdDuel.id);
        expect(updatedDuel!.hostScore).toBe(1);
        expect(updatedDuel!.pendingUpdates.host).toHaveLength(0);
        expect(updatedDuel!.pendingUpdates.guest).toHaveLength(0);
    });

    it("awards winning and participation points", async () => {
        const host = await Models.AttendeeProfile.create(TESTER_PROFILE);
        const guest = await Models.AttendeeProfile.create(TEST_PROFILE_2);
        const createdDuel = await Models.Duel.create(TEST_DUEL);

        await putAsAttendee(`/duel/${createdDuel.id}/`)
            .send({
                hostScore: 3,
            })
            .expect(StatusCode.SuccessOK);

        const winner = await Models.AttendeeProfile.findById(host.id);
        expect(winner!.pointsAccumulated).toEqual(5);
        expect(winner!.points).toEqual(5);
        expect(winner!.duelsPlayed).toEqual(1);
        expect(winner!.duelsWon).toEqual(1);

        const loser = await Models.AttendeeProfile.findById(guest.id);
        expect(loser!.pointsAccumulated).toEqual(1);
        expect(loser!.points).toEqual(1);
        expect(loser!.duelsPlayed).toEqual(1);
        expect(loser!.duelsWon).toEqual(0);

        const updatedDuel = await Models.Duel.findById(createdDuel.id);
        expect(updatedDuel!.hasFinished).toBe(true);
    });

    it("does not award points for non-scoring duel", async () => {
        const host = await Models.AttendeeProfile.create(TESTER_PROFILE);
        const guest = await Models.AttendeeProfile.create(TEST_PROFILE_2);
        const createdDuel = await Models.Duel.create({ ...TEST_DUEL, isScoringDuel: false });

        await putAsAttendee(`/duel/${createdDuel.id}/`)
            .send({
                hostScore: 3,
            })
            .expect(StatusCode.SuccessOK);

        const winner = await Models.AttendeeProfile.findById(host.id);
        expect(winner!.pointsAccumulated).toEqual(0);
        expect(winner!.points).toEqual(0);
        expect(winner!.duelsPlayed).toEqual(1);
        expect(winner!.duelsWon).toEqual(1);

        const loser = await Models.AttendeeProfile.findById(guest.id);
        expect(loser!.pointsAccumulated).toEqual(0);
        expect(loser!.points).toEqual(0);
        expect(loser!.duelsPlayed).toEqual(1);
        expect(loser!.duelsWon).toEqual(0);

        const updatedDuel = await Models.Duel.findById(createdDuel.id);
        expect(updatedDuel!.hasFinished).toBe(true);
    });
});

describe("DELETE /duel/:id/", () => {
    it("successfully deletes existing duel", async () => {
        const createdDuel = await Models.Duel.create(TEST_DUEL);

        await delAsAdmin(`/duel/${createdDuel.id}/`).expect(StatusCode.SuccessOK);
        const deletedDuel = await Models.Duel.findById(createdDuel.id);
        expect(deletedDuel).toBeNull();
    });
});
