import { beforeEach, describe, expect, it } from "@jest/globals";
import { getAsAttendee, postAsStaff, putAsStaff, delAsStaff } from "../../common/testTools";
import { StatusCode } from "status-code-enum";
import Models from "../../common/models";
import { AttendeeTeam, CreateAttendeeTeamRequest } from "./attendee-team-schemas";
import { AttendeeProfile } from "../profile/profile-schemas";
import { Event, EventType } from "../event/event-schemas";
import { TESTER } from "../../common/testTools";
import { generateQRCode } from "../user/user-lib";

const TEST_TEAM = {
    name: "Team 1",
    badge: "https://HackIllinois/team1.png",
    points: 100,
    members: 10,
} satisfies AttendeeTeam;

const TEST_EMPTY_TEAM_1 = {
    name: "A",
    badge: "https://HackIllinois/team1.png",
    points: 0,
    members: 0,
} satisfies AttendeeTeam;

const TEST_EMPTY_TEAM_2 = {
    name: "B",
    badge: "https://HackIllinois/team2.png",
    points: 0,
    members: 0,
} satisfies AttendeeTeam;

const TEST_TEAM_REQUEST = {
    name: "B",
    badge: "https://HackIllinois/team2.png",
} satisfies CreateAttendeeTeamRequest;

const TESTER_PROFILE = {
    userId: "some-user",
    displayName: "TestDisplayName",
    avatarUrl: TESTER.avatarUrl,
    discordTag: "TestTag",
    points: 0,
    pointsAccumulated: 100,
    foodWave: 0,
    dietaryRestrictions: ["Vegetarian", "Peanut Allergy"],
    shirtSize: "M",
    team: "Team 1",
    teamBadge: "https://HackIllinois/team1.png",
} satisfies AttendeeProfile;

const TEST_ASSIGN_1 = {
    userId: "attendee1",
    displayName: "TestDisplayName",
    avatarUrl: "TestAvatarUrl",
    discordTag: "TestTag",
    points: 0,
    pointsAccumulated: 0,
    foodWave: 0,
    dietaryRestrictions: ["Vegetarian", "Peanut Allergy"],
    shirtSize: "M",
} satisfies AttendeeProfile;

const TEST_ASSIGN_2 = {
    userId: "attendee2",
    displayName: "TestDisplayName",
    avatarUrl: "TestAvatarUrl",
    discordTag: "TestTag",
    points: 0,
    pointsAccumulated: 0,
    foodWave: 0,
    dietaryRestrictions: ["Vegetarian", "Peanut Allergy"],
    shirtSize: "M",
} satisfies AttendeeProfile;

const TEST_ASSIGN_3 = {
    userId: "attendee3",
    displayName: "TestDisplayName",
    avatarUrl: "TestAvatarUrl",
    discordTag: "TestTag",
    points: 0,
    pointsAccumulated: 0,
    foodWave: 0,
    dietaryRestrictions: ["Vegetarian", "Peanut Allergy"],
    shirtSize: "M",
} satisfies AttendeeProfile;

const TEST_ASSIGN_4 = {
    userId: "attendee4",
    displayName: "TestDisplayName",
    avatarUrl: "TestAvatarUrl",
    discordTag: "TestTag",
    points: 0,
    pointsAccumulated: 0,
    foodWave: 0,
    dietaryRestrictions: ["Vegetarian", "Peanut Allergy"],
    shirtSize: "M",
} satisfies AttendeeProfile;

const TEST_EVENT = {
    eventId: "some-event",
    isStaff: false,
    name: "Example Name",
    description: "Example Description",
    startTime: 1707069600,
    endTime: 1707069900,
    eventType: EventType.WORKSHOP,
    locations: [
        {
            description: "Siebel ",
            latitude: 40.113812,
            longitude: -88.224937,
        },
    ],
    isAsync: false,
    mapImageUrl: "",
    sponsor: "",
    points: 100,
    isPrivate: false,
    displayOnStaffCheckIn: false,
    isPro: false,
} satisfies Event;

beforeEach(async () => {
    await Models.AttendeeProfile.create(TESTER_PROFILE);
    await Models.Event.create(TEST_EVENT);
});

describe("POST /attendee-team/", () => {
    it("successfully creates new team", async () => {
        const response = await postAsStaff("/attendee-team/").send(TEST_TEAM_REQUEST).expect(StatusCode.SuccessCreated);
        const data = JSON.parse(response.text);
        expect(data).toMatchObject(TEST_EMPTY_TEAM_2);

        const stored = await Models.AttendeeTeam.findById(data._id);
        expect(stored?.toObject()).toMatchObject(TEST_EMPTY_TEAM_2);
    });
});

describe("GET /attendee-team/", () => {
    it("returns an empty list when no teams exist", async () => {
        const response = await getAsAttendee("/attendee-team/").expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toEqual([]);
    });

    it("returns all existing teams", async () => {
        await Models.AttendeeTeam.create(TEST_TEAM);

        const response = await getAsAttendee("/attendee-team/").expect(StatusCode.SuccessOK);
        const data = JSON.parse(response.text);

        expect(Array.isArray(data)).toBe(true);
        expect(data[0]).toMatchObject(TEST_TEAM);
    });

    it("updates team points when attendee completes event", async () => {
        const validAttendeeQRCodeURL = generateQRCode(TESTER_PROFILE.userId, Math.floor(Date.now() / 1000) + 300);
        const validAttendeeQRCode = new URL(validAttendeeQRCodeURL).searchParams.get("qr")!;

        await Models.AttendeeTeam.create(TEST_TEAM);

        // Check in attendee to redeem event points
        await putAsStaff("/staff/scan-attendee/")
            .send({ eventId: TEST_EVENT.eventId, attendeeQRCode: validAttendeeQRCode })
            .expect(StatusCode.SuccessOK);

        const response = await getAsAttendee("/attendee-team/").expect(StatusCode.SuccessOK);
        const data = JSON.parse(response.text);

        expect(Array.isArray(data)).toBe(true);
        expect(data[0].points).toEqual(TEST_TEAM.points + TEST_EVENT.points);
    });
});

describe("DELETE /attendee-team/:id/", () => {
    it("returns 404 for non-existent team", async () => {
        const response = await delAsStaff("/staff-team/invalidId/").expect(StatusCode.ClientErrorNotFound);
        expect(JSON.parse(response.text)).toMatchObject({
            error: "NotFound",
            message: "Failed to find team",
        });
    });

    it("deletes an existing team successfully", async () => {
        const createdTeam = await Models.AttendeeTeam.create(TEST_TEAM);
        await delAsStaff(`/attendee-team/${createdTeam.id}/`).expect(StatusCode.SuccessNoContent);

        const deleted = await Models.AttendeeTeam.findById(createdTeam.id);
        expect(deleted).toBeNull();
    });
});

describe("POST /attendee-team/assign", () => {
    beforeEach(async () => {
        await Models.AttendeeProfile.deleteMany({});
        await Models.AttendeeTeam.create(TEST_EMPTY_TEAM_1);
        await Models.AttendeeTeam.create(TEST_EMPTY_TEAM_2);
        await Models.AttendeeProfile.create(TEST_ASSIGN_1);
        await Models.AttendeeProfile.create(TEST_ASSIGN_2);
        await Models.AttendeeProfile.create(TEST_ASSIGN_3);
        await Models.AttendeeProfile.create(TEST_ASSIGN_4);
    });

    it("successfully assigns attendees to teams", async () => {
        const results = await postAsStaff("/attendee-team/assign").expect(StatusCode.SuccessOK);
        const data = JSON.parse(results.text);

        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBe(2);

        const updatedAttendees = await Models.AttendeeProfile.find({ team: { $exists: true }, teamBadge: { $exists: true } });
        expect(updatedAttendees.length).toBe(4);

        // Check that attendee teams are updated correctly
        for (const attendee of updatedAttendees) {
            expect([TEST_EMPTY_TEAM_1.name, TEST_EMPTY_TEAM_2.name]).toContain(attendee.team);
            expect([TEST_EMPTY_TEAM_1.badge, TEST_EMPTY_TEAM_2.badge]).toContain(attendee.teamBadge);
        }

        const updatedTeams = await Models.AttendeeTeam.find();

        // Check that teams are even and member counts are updated correctly
        for (const team of updatedTeams) {
            expect(team.members).toBe(2);
        }
    });
});
