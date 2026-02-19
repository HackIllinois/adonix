import { beforeEach, describe, expect, it } from "@jest/globals";
import {
    putAsAttendee,
    putAsStaff,
    TESTER,
    delAsAdmin,
    getAsAttendee,
    postAsAdmin,
    postAsAttendee,
    putAsAdmin,
    delAsAttendee,
} from "../../common/testTools";

import { Event, EventAttendance, EventType } from "../event/event-schemas";
import { StatusCode } from "status-code-enum";
import Models from "../../common/models";
import { AttendeeProfile } from "../profile/profile-schemas";
import { generateQRCode } from "../user/user-lib";
import { StaffTeam } from "../staff-team/staff-team-schemas";

const TESTER_EVENT_ATTENDANCE = {
    eventId: "some-event",
    attendees: [],
    excusedAttendees: [],
} satisfies EventAttendance;

const TESTER_PROFILE = {
    userId: "some-user",
    displayName: "TestDisplayName",
    avatarUrl: TESTER.avatarUrl,
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

const TESTER_TEAM = {
    name: "Systems",
} satisfies StaffTeam;

const TESTER_STAFF_INFO = {
    name: "Test User",
    title: "Systems Lead",
    emoji: "💻",
    profilePictureUrl: "https://example.com/profile.jpg",
    quote: "six seven",
    isActive: true,
};

const INACTIVE_STAFF_INFO = {
    name: "Inactive Staff",
    title: "Former Lead",
    emoji: "👋",
    profilePictureUrl: "https://example.com/inactive.jpg",
    quote: "Goodbye",
    isActive: false,
};

// Before each test, initialize database with Event in EventAttendance
beforeEach(async () => {
    await Models.EventAttendance.create(TESTER_EVENT_ATTENDANCE);
    await Models.AttendeeProfile.create(TESTER_PROFILE);
    await Models.Event.create(TEST_EVENT);
    await Models.StaffTeam.create(TESTER_TEAM);
});
describe("GET /staff/info/", () => {
    it("returns all active staff members for public access", async () => {
        const team = await Models.StaffTeam.findOne({ name: TESTER_TEAM.name });
        await Models.StaffInfo.create({
            name: TESTER_STAFF_INFO.name,
            title: TESTER_STAFF_INFO.title,
            team: team!._id,
            emoji: TESTER_STAFF_INFO.emoji,
            profilePictureUrl: TESTER_STAFF_INFO.profilePictureUrl,
            quote: TESTER_STAFF_INFO.quote,
            isActive: true,
        });

        const response = await getAsAttendee("/staff/info/").expect(StatusCode.SuccessOK);

        const data = JSON.parse(response.text);
        expect(data.staffInfo).toHaveLength(1);
        expect(data.staffInfo[0]).toMatchObject({
            name: TESTER_STAFF_INFO.name,
            title: TESTER_STAFF_INFO.title,
            emoji: TESTER_STAFF_INFO.emoji,
            profilePictureUrl: TESTER_STAFF_INFO.profilePictureUrl,
            quote: TESTER_STAFF_INFO.quote,
            isActive: true,
        });
        expect(data.staffInfo[0].team).toBeDefined();
    });

    it("excludes inactive staff members", async () => {
        const team = await Models.StaffTeam.findOne({ name: TESTER_TEAM.name });

        await Models.StaffInfo.create({
            name: TESTER_STAFF_INFO.name,
            title: TESTER_STAFF_INFO.title,
            team: team!._id,
            isActive: true,
        });

        await Models.StaffInfo.create({
            name: INACTIVE_STAFF_INFO.name,
            title: INACTIVE_STAFF_INFO.title,
            team: team!._id,
            isActive: false,
        });

        const response = await getAsAttendee("/staff/info/").expect(StatusCode.SuccessOK);

        const data = JSON.parse(response.text);
        expect(data.staffInfo).toHaveLength(1);
        expect(data.staffInfo[0].name).toBe(TESTER_STAFF_INFO.name);
    });

    it("returns empty array when no active staff exists", async () => {
        const response = await getAsAttendee("/staff/info/").expect(StatusCode.SuccessOK);

        const data = JSON.parse(response.text);
        expect(data.staffInfo).toHaveLength(0);
    });

    it("returns staff without team when team is not set", async () => {
        await Models.StaffInfo.create({
            name: TESTER_STAFF_INFO.name,
            title: TESTER_STAFF_INFO.title,
            isActive: true,
        });

        const response = await getAsAttendee("/staff/info/").expect(StatusCode.SuccessOK);

        const data = JSON.parse(response.text);
        expect(data.staffInfo).toHaveLength(1);
        expect(data.staffInfo[0].team).toBeUndefined();
    });
});

describe("POST /staff/info/", () => {
    it("successfully creates staff info", async () => {
        const team = await Models.StaffTeam.findOne({ name: TESTER_TEAM.name });

        const response = await postAsAdmin("/staff/info/")
            .send({
                name: TESTER_STAFF_INFO.name,
                title: TESTER_STAFF_INFO.title,
                team: team!._id.toString(),
                emoji: TESTER_STAFF_INFO.emoji,
                profilePictureUrl: TESTER_STAFF_INFO.profilePictureUrl,
                quote: TESTER_STAFF_INFO.quote,
                isActive: true,
            })
            .expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({ success: true });

        const staffInfo = await Models.StaffInfo.findOne({ name: TESTER_STAFF_INFO.name }).populate("team");
        expect(staffInfo).toBeDefined();
        expect(staffInfo?.title).toBe(TESTER_STAFF_INFO.title);
        expect((staffInfo?.team as unknown as StaffTeam)?.name).toBe(TESTER_TEAM.name);
    });

    it("creates staff info without optional fields", async () => {
        await postAsAdmin("/staff/info/")
            .send({
                name: "New Staff",
                title: "Co-Director",
                isActive: true,
            })
            .expect(StatusCode.SuccessOK);

        const staffInfo = await Models.StaffInfo.findOne({ name: "New Staff" });

        expect(staffInfo?.title).toBe("Co-Director");
        expect(staffInfo?.emoji).toBeUndefined();
        expect(staffInfo?.quote).toBeUndefined();
        expect(staffInfo?.isActive).toBe(true);
    });

    it("creates staff info with default isActive as true", async () => {
        await postAsAdmin("/staff/info/")
            .send({
                name: "Default Active Staff",
                title: "Developer",
            })
            .expect(StatusCode.SuccessOK);

        const staffInfo = await Models.StaffInfo.findOne({ name: "Default Active Staff" });
        expect(staffInfo?.isActive).toBe(true);
    });

    it("rejects non-admin users", async () => {
        await postAsAttendee("/staff/info/")
            .send({
                name: TESTER_STAFF_INFO.name,
                title: TESTER_STAFF_INFO.title,
                isActive: true,
            })
            .expect(StatusCode.ClientErrorForbidden);
    });
});

describe("PUT /staff/info/", () => {
    let staffId: string;

    beforeEach(async () => {
        const team = await Models.StaffTeam.findOne({ name: TESTER_TEAM.name });

        const staffInfo = await Models.StaffInfo.create({
            name: TESTER_STAFF_INFO.name,
            title: TESTER_STAFF_INFO.title,
            team: team!._id,
            emoji: TESTER_STAFF_INFO.emoji,
            profilePictureUrl: TESTER_STAFF_INFO.profilePictureUrl,
            quote: TESTER_STAFF_INFO.quote,
            isActive: true,
        });

        staffId = staffInfo._id.toString();
    });

    it("successfully updates staff info", async () => {
        const updatedData = {
            staffId: staffId,
            name: "Updated Name",
            title: "Lead Systems Engineer",
            emoji: "🚀",
            profilePictureUrl: "https://example.com/new-profile.jpg",
            quote: "Updated quote",
            isActive: true,
        };

        const response = await putAsAdmin("/staff/info/").send(updatedData).expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({ success: true });

        const staffInfo = await Models.StaffInfo.findById(staffId);

        expect(staffInfo?.name).toBe(updatedData.name);
        expect(staffInfo?.title).toBe(updatedData.title);
        expect(staffInfo?.emoji).toBe(updatedData.emoji);
        expect(staffInfo?.quote).toBe(updatedData.quote);
    });

    it("can deactivate a staff member", async () => {
        await putAsAdmin("/staff/info/")
            .send({
                staffId: staffId,
                name: TESTER_STAFF_INFO.name,
                title: TESTER_STAFF_INFO.title,
                isActive: false,
            })
            .expect(StatusCode.SuccessOK);

        const staffInfo = await Models.StaffInfo.findById(staffId);

        expect(staffInfo?.isActive).toBe(false);
    });

    it("can update only specific fields", async () => {
        await putAsAdmin("/staff/info/")
            .send({
                staffId: staffId,
                title: "New Title Only",
            })
            .expect(StatusCode.SuccessOK);

        const staffInfo = await Models.StaffInfo.findById(staffId);

        expect(staffInfo?.title).toBe("New Title Only");
        expect(staffInfo?.name).toBe(TESTER_STAFF_INFO.name);
    });

    it("returns error when staff does not exist", async () => {
        const response = await putAsAdmin("/staff/info/")
            .send({
                staffId: "507f1f77bcf86cd799439011",
                name: "Test",
                title: "Test",
                isActive: true,
            })
            .expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toMatchObject({
            error: "StaffNotFound",
        });
    });

    it("rejects non-admin users", async () => {
        await putAsAttendee("/staff/info/")
            .send({
                staffId: staffId,
                name: TESTER_STAFF_INFO.name,
                title: TESTER_STAFF_INFO.title,
                isActive: true,
            })
            .expect(StatusCode.ClientErrorForbidden);
    });
});

describe("DELETE /staff/info/", () => {
    let staffId: string;

    beforeEach(async () => {
        const team = await Models.StaffTeam.findOne({ name: TESTER_TEAM.name });

        const staffInfo = await Models.StaffInfo.create({
            name: TESTER_STAFF_INFO.name,
            title: TESTER_STAFF_INFO.title,
            team: team!._id,
            emoji: TESTER_STAFF_INFO.emoji,
            profilePictureUrl: TESTER_STAFF_INFO.profilePictureUrl,
            quote: TESTER_STAFF_INFO.quote,
            isActive: true,
        });

        staffId = staffInfo._id.toString();
    });

    it("successfully deletes staff info", async () => {
        const response = await delAsAdmin("/staff/info/").send({ staffId: staffId }).expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({ success: true });

        const staffInfo = await Models.StaffInfo.findById(staffId);
        expect(staffInfo).toBeNull();
    });

    it("returns error when staff does not exist", async () => {
        const response = await delAsAdmin("/staff/info/")
            .send({ staffId: "507f1f77bcf86cd799439011" })
            .expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toMatchObject({
            error: "StaffNotFound",
        });
    });

    it("rejects non-admin users", async () => {
        await delAsAttendee("/staff/info/").send({ staffId: staffId }).expect(StatusCode.ClientErrorForbidden);
    });
});

describe("PUT /staff/scan-attendee/", () => {
    let validAttendeeQRCode: string;
    let expiredAttendeeQRCode: string;
    let testUserId: string;

    beforeEach(async () => {
        // Clear attendance records
        await Models.EventAttendance.deleteMany({});
        await Models.UserAttendance.deleteMany({});

        // Setup test user and generate QR codes
        testUserId = TESTER_PROFILE.userId;
        const currentTime = Math.floor(Date.now() / 1000);

        // Generate valid QR code
        const validAttendeeQRCodeURL = generateQRCode(testUserId, currentTime + 300);
        validAttendeeQRCode = new URL(validAttendeeQRCodeURL).searchParams.get("qr")!;

        // Generate expired QR code
        const expiredAttendeeQRCodeURL = generateQRCode(testUserId, currentTime - 300);
        expiredAttendeeQRCode = new URL(expiredAttendeeQRCodeURL).searchParams.get("qr")!;
    });

    it("successfully checks in user with valid QR code", async () => {
        const response = await putAsStaff("/staff/scan-attendee/")
            .send({ eventId: TEST_EVENT.eventId, attendeeQRCode: validAttendeeQRCode })
            .expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({
            success: true,
            userId: testUserId,
            eventName: TEST_EVENT.name,
            dietaryRestrictions: TESTER_PROFILE.dietaryRestrictions,
        });

        // Verify attendance records
        const eventAttendance = await Models.EventAttendance.findOne({
            eventId: TEST_EVENT.eventId,
        });
        const userAttendance = await Models.UserAttendance.findOne({
            userId: testUserId,
        });

        expect(eventAttendance?.attendees).toContain(testUserId);
        expect(userAttendance?.attendance).toContain(TEST_EVENT.eventId);
    });

    it("rejects non-staff users", async () => {
        await putAsAttendee("/staff/scan-attendee/")
            .send({ eventId: TEST_EVENT.eventId, attendeeQRCode: validAttendeeQRCode })
            .expect(StatusCode.ClientErrorForbidden);
    });

    it("rejects invalid QR codes", async () => {
        await putAsStaff("/staff/scan-attendee/")
            .send({ eventId: TEST_EVENT.eventId, attendeeQRCode: "invalidQR" })
            .expect(StatusCode.ClientErrorBadRequest);
    });

    it("rejects expired QR codes", async () => {
        await putAsStaff("/staff/scan-attendee/")
            .send({ eventId: TEST_EVENT.eventId, attendeeQRCode: expiredAttendeeQRCode })
            .expect(StatusCode.ClientErrorBadRequest);
    });

    it("handles non-existent events", async () => {
        await putAsStaff("/staff/scan-attendee/")
            .send({ eventId: "non-existent-event", attendeeQRCode: validAttendeeQRCode })
            .expect(StatusCode.ClientErrorNotFound);
    });

    it("prevents duplicate check-ins", async () => {
        // First check-in should succeed
        await putAsStaff("/staff/scan-attendee/")
            .send({ eventId: TEST_EVENT.eventId, attendeeQRCode: validAttendeeQRCode })
            .expect(StatusCode.SuccessOK);

        // Second check-in should fail
        const response = await putAsStaff("/staff/scan-attendee/")
            .send({ eventId: TEST_EVENT.eventId, attendeeQRCode: validAttendeeQRCode })
            .expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toMatchObject({
            error: "AlreadyCheckedIn",
        });
    });

    it("handles missing profile", async () => {
        // Remove profile
        await Models.AttendeeProfile.deleteOne({ userId: testUserId });

        await putAsStaff("/staff/scan-attendee/")
            .send({ eventId: TEST_EVENT.eventId, attendeeQRCode: validAttendeeQRCode })
            .expect(StatusCode.ServerErrorInternal);
    });
});
