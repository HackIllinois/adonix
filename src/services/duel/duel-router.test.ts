import { describe, expect, it } from "@jest/globals";
import { getAsAttendee, postAsAttendee, putAsAttendee, delAsAdmin } from "../../common/testTools";
import { StatusCode } from "status-code-enum";
import Models from "../../common/models";
import { DuelCreateRequest } from "./duel-schemas";
import { TESTER } from "../../common/testTools";
import { AttendeeProfile } from "../profile/profile-schemas";
import exp from "constants";

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
} satisfies AttendeeProfile;

const TEST_DUEL = {
    hostId: TESTER.id,
    guestId: "google67890",
    hostScore: 0,
    guestScore: 2,
    hostHasDisconnected: false,
    guestHasDisconnected: false,
    hasFinished: false,
    pendingUpdates: { host: [], guest: ['{"hostScore":3}'] },
};

const TEST_DUEL_2 = {
    hostId: "google12345",
    guestId: TESTER.id,
    hostScore: 0,
    guestScore: 2,
    hostHasDisconnected: false,
    guestHasDisconnected: false,
    hasFinished: false,
    pendingUpdates: { host: ['{"hostScore":1}'], guest: [] },
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

    it("successfully enforces maximum of 5 duels", async () => {
        for (let i = 0; i < 5; i++) {
            await postAsAttendee("/duel/").send(TEST_DUEL_REQUEST).expect(StatusCode.SuccessCreated);
        }
        const stored = await Models.Duel.find();
        expect(stored.length).toBe(5);

        await postAsAttendee("/duel/").send(TEST_DUEL_REQUEST).expect(StatusCode.ClientErrorConflict);
        const storedAfterConflict = await Models.Duel.find();
        expect(storedAfterConflict.length).toBe(5);
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

    it("awards points to winner of duel", async () => {
        const profile = await Models.AttendeeProfile.create(TESTER_PROFILE);
        const createdDuel = await Models.Duel.create(TEST_DUEL);

        await putAsAttendee(`/duel/${createdDuel.id}/`)
            .send({
                hostScore: 3,
            })
            .expect(StatusCode.SuccessOK);

        const winner = await Models.AttendeeProfile.findById(profile.id);
        expect(winner!.pointsAccumulated).toEqual(10);
        expect(winner!.points).toEqual(10);
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
