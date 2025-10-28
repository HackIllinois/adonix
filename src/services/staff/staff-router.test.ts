import { beforeEach, describe, expect, it } from "@jest/globals";
import {
    putAsAttendee,
    putAsStaff,
    getAsAttendee,
    postAsAttendee,
    postAsAdmin,
    putAsAdmin,
    delAsAdmin,
    delAsAttendee,
    TESTER,
} from "../../common/testTools";

import { Event, EventAttendance, EventType } from "../event/event-schemas";
import { StatusCode } from "status-code-enum";
import Models from "../../common/models";
import {
    Degree,
    Gender,
    HackInterest,
    HackOutreach,
    Race,
    RegistrationApplicationSubmitted,
} from "../registration/registration-schemas";
import { AttendeeProfile } from "../profile/profile-schemas";
import { generateQRCode } from "../user/user-lib";
import { UserInfo } from "../user/user-schemas";
import { Team } from "../team/team-schemas";

const TESTER_EVENT_ATTENDANCE = {
    eventId: "some-event",
    attendees: [],
    excusedAttendees: [],
} satisfies EventAttendance;

const TESTER_REGISTRATION = {
    userId: "some-user",
    preferredName: "W",
    emailAddress: "w@illinois.edu",
    location: "Illinois",
    degree: Degree.ASSOCIATES,
    university: "University of Illinois (Chicago)",
    major: "Computer Science",
    minor: "Computer Science",
    gradYear: 2030,
    hackEssay1: "yay",
    hackEssay2: "yay",
    proEssay: "",
    hackInterest: [HackInterest.TECHNICAL_WORKSHOPS],
    hackOutreach: [HackOutreach.INSTAGRAM],
    dietaryRestrictions: ["Vegan", "No Pork"],
    resumeFileName: "GitHub cheatsheet.pdf",
    legalName: "Ronakin Kanandani",
    considerForGeneral: false,
    requestedTravelReimbursement: true,
    gender: Gender.NO_ANSWER,
    race: [Race.NO_ANSWER],
    optionalEssay: "Optional Essay",
} satisfies RegistrationApplicationSubmitted;

const TESTER_PROFILE = {
    userId: TESTER_REGISTRATION.userId,
    displayName: "TestDisplayName",
    avatarUrl: TESTER.avatarUrl,
    discordTag: "TestTag",
    points: 0,
    pointsAccumulated: 0,
    foodWave: 0,
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

const TESTER_USER_INFO = {
    userId: "testuser123",
    name: "Test User",
    email: "test@example.com",
} satisfies UserInfo;

const TESTER_STAFF_INFO = {
    title: "Systems Lead",
    team: "Systems",
    emoji: "💻",
    profilePictureUrl: "https://example.com/profile.jpg",
    quote: "Code is poetry",
    isActive: true,
};

const TESTER_TEAM = {
    name: "Systems",
} satisfies Team;

const INACTIVE_STAFF_USER = {
    userId: "inactivestaff456",
    name: "Inactive Staff",
    email: "inactive@example.com",
} satisfies UserInfo;

const INACTIVE_STAFF_INFO = {
    title: "Former Lead",
    team: "Systems",
    emoji: "👋",
    profilePictureUrl: "https://example.com/inactive.jpg",
    quote: "Goodbye",
    isActive: false,
};

// Before each test, initialize database with Event in EventAttendance
beforeEach(async () => {
    await Models.EventAttendance.create(TESTER_EVENT_ATTENDANCE);
    await Models.RegistrationApplicationSubmitted.create(TESTER_REGISTRATION);
    await Models.AttendeeProfile.create(TESTER_PROFILE);
    await Models.Event.create(TEST_EVENT);
    await Models.Team.create(TESTER_TEAM);
    await Models.UserInfo.create(TESTER_USER_INFO);
    await Models.UserInfo.create(INACTIVE_STAFF_USER);
});

describe("GET /staff/info/", () => {
    it("returns all active staff members for public access", async () => {
        const userInfo = await Models.UserInfo.findOne({ userId: TESTER_USER_INFO.userId });
        const team = await Models.Team.findOne({ name: TESTER_TEAM.name });

        const staffInfo = await Models.StaffInfo.create({
            user: userInfo!._id,
            title: TESTER_STAFF_INFO.title,
            team: team!._id,
            emoji: TESTER_STAFF_INFO.emoji,
            profilePictureUrl: TESTER_STAFF_INFO.profilePictureUrl,
            quote: TESTER_STAFF_INFO.quote,
            isActive: true,
        });

        await Models.UserInfo.updateOne({ userId: TESTER_USER_INFO.userId }, { staffInfo: staffInfo._id });

        const response = await getAsAttendee("/staff/info/").expect(StatusCode.SuccessOK);

        const data = JSON.parse(response.text);
        expect(data.staff).toHaveLength(1);
        expect(data.staff[0]).toMatchObject({
            userId: TESTER_USER_INFO.userId,
            name: TESTER_USER_INFO.name,
            title: TESTER_STAFF_INFO.title,
            team: TESTER_TEAM.name,
            emoji: TESTER_STAFF_INFO.emoji,
            profilePictureUrl: TESTER_STAFF_INFO.profilePictureUrl,
            quote: TESTER_STAFF_INFO.quote,
            isActive: true,
        });
    });

    it("excludes inactive staff members", async () => {
        const activeUser = await Models.UserInfo.findOne({ userId: TESTER_USER_INFO.userId });
        const inactiveUser = await Models.UserInfo.findOne({ userId: INACTIVE_STAFF_USER.userId });
        const team = await Models.Team.findOne({ name: TESTER_TEAM.name });

        const activeStaff = await Models.StaffInfo.create({
            user: activeUser!._id,
            title: TESTER_STAFF_INFO.title,
            team: team!._id,
            isActive: true,
        });

        const inactiveStaff = await Models.StaffInfo.create({
            user: inactiveUser!._id,
            title: INACTIVE_STAFF_INFO.title,
            team: team!._id,
            isActive: false,
        });

        await Models.UserInfo.updateOne({ userId: TESTER_USER_INFO.userId }, { staffInfo: activeStaff._id });
        await Models.UserInfo.updateOne({ userId: INACTIVE_STAFF_USER.userId }, { staffInfo: inactiveStaff._id });

        const response = await getAsAttendee("/staff/info/").expect(StatusCode.SuccessOK);

        const data = JSON.parse(response.text);
        expect(data.staff).toHaveLength(1);
        expect(data.staff[0].userId).toBe(TESTER_USER_INFO.userId);
    });

    it("returns empty array when no active staff exists", async () => {
        const response = await getAsAttendee("/staff/info/").expect(StatusCode.SuccessOK);

        const data = JSON.parse(response.text);
        expect(data.staff).toHaveLength(0);
    });
});

describe("POST /staff/info/", () => {
    it("successfully creates staff info for a user", async () => {
        const response = await postAsAdmin("/staff/info/")
            .send({
                userId: TESTER_USER_INFO.userId,
                ...TESTER_STAFF_INFO,
            })
            .expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({ success: true });

        const userInfo = await Models.UserInfo.findOne({ userId: TESTER_USER_INFO.userId }).populate("staffInfo");
        expect(userInfo?.staffInfo).toBeDefined();

        const staffInfo = await Models.StaffInfo.findOne({ user: userInfo!._id }).populate("team");
        expect(staffInfo).toBeDefined();
        expect(staffInfo?.title).toBe(TESTER_STAFF_INFO.title);
        expect((staffInfo?.team as unknown as Team)?.name).toBe(TESTER_STAFF_INFO.team);
    });

    it("creates staff info without optional fields", async () => {
        await postAsAdmin("/staff/info/")
            .send({
                userId: TESTER_USER_INFO.userId,
                title: "Co-Director",
                team: "Systems",
            })
            .expect(StatusCode.SuccessOK);

        const userInfo = await Models.UserInfo.findOne({ userId: TESTER_USER_INFO.userId });
        const staffInfo = await Models.StaffInfo.findOne({ user: userInfo!._id });

        expect(staffInfo?.title).toBe("Co-Director");
        expect(staffInfo?.emoji).toBeUndefined();
        expect(staffInfo?.quote).toBeUndefined();
        expect(staffInfo?.isActive).toBe(true); // Default value
    });

    it("returns error when user does not exist", async () => {
        const response = await postAsAdmin("/staff/info/")
            .send({
                userId: "nonexistent123",
                ...TESTER_STAFF_INFO,
            })
            .expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toMatchObject({
            error: "NotFound",
        });
    });

    it("rejects non-admin users", async () => {
        await postAsAttendee("/staff/info/")
            .send({
                userId: TESTER_USER_INFO.userId,
                ...TESTER_STAFF_INFO,
            })
            .expect(StatusCode.ClientErrorForbidden);
    });
});

describe("PUT /staff/info/", () => {
    beforeEach(async () => {
        const userInfo = await Models.UserInfo.findOne({ userId: TESTER_USER_INFO.userId });
        const team = await Models.Team.findOne({ name: TESTER_TEAM.name });

        const staffInfo = await Models.StaffInfo.create({
            user: userInfo!._id,
            title: TESTER_STAFF_INFO.title,
            team: team!._id,
            emoji: TESTER_STAFF_INFO.emoji,
            profilePictureUrl: TESTER_STAFF_INFO.profilePictureUrl,
            quote: TESTER_STAFF_INFO.quote,
            isActive: true,
        });

        await Models.UserInfo.updateOne({ userId: TESTER_USER_INFO.userId }, { staffInfo: staffInfo._id });
    });

    it("successfully updates staff info", async () => {
        const updatedData = {
            userId: TESTER_USER_INFO.userId,
            title: "Lead Systems Engineer",
            team: "Systems",
            emoji: "🚀",
            profilePictureUrl: "https://example.com/new-profile.jpg",
            quote: "Updated quote",
            isActive: true,
        };

        const response = await putAsAdmin("/staff/info/").send(updatedData).expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({ success: true });

        const userInfo = await Models.UserInfo.findOne({ userId: TESTER_USER_INFO.userId });
        const staffInfo = await Models.StaffInfo.findOne({ user: userInfo!._id });

        expect(staffInfo?.title).toBe(updatedData.title);
        expect(staffInfo?.emoji).toBe(updatedData.emoji);
        expect(staffInfo?.quote).toBe(updatedData.quote);
    });

    it("can deactivate a staff member", async () => {
        await putAsAdmin("/staff/info/")
            .send({
                userId: TESTER_USER_INFO.userId,
                title: TESTER_STAFF_INFO.title,
                team: "Systems",
                isActive: false,
            })
            .expect(StatusCode.SuccessOK);

        const userInfo = await Models.UserInfo.findOne({ userId: TESTER_USER_INFO.userId });
        const staffInfo = await Models.StaffInfo.findOne({ user: userInfo!._id });

        expect(staffInfo?.isActive).toBe(false);
    });

    it("returns error when user does not exist", async () => {
        const response = await putAsAdmin("/staff/info/")
            .send({
                userId: "nonexistent123",
                ...TESTER_STAFF_INFO,
            })
            .expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toMatchObject({
            error: "NotFound",
        });
    });

    it("returns error when staff info does not exist", async () => {
        const response = await putAsAdmin("/staff/info/")
            .send({
                userId: INACTIVE_STAFF_USER.userId,
                ...TESTER_STAFF_INFO,
            })
            .expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toMatchObject({
            error: "StaffNotFound",
        });
    });

    it("rejects non-admin users", async () => {
        await putAsAttendee("/staff/info/")
            .send({
                userId: TESTER_USER_INFO.userId,
                ...TESTER_STAFF_INFO,
            })
            .expect(StatusCode.ClientErrorForbidden);
    });
});

describe("DELETE /staff/info/", () => {
    beforeEach(async () => {
        const userInfo = await Models.UserInfo.findOne({ userId: TESTER_USER_INFO.userId });
        const team = await Models.Team.findOne({ name: TESTER_TEAM.name });

        const staffInfo = await Models.StaffInfo.create({
            user: userInfo!._id,
            title: TESTER_STAFF_INFO.title,
            team: team!._id,
            emoji: TESTER_STAFF_INFO.emoji,
            profilePictureUrl: TESTER_STAFF_INFO.profilePictureUrl,
            quote: TESTER_STAFF_INFO.quote,
            isActive: true,
        });

        await Models.UserInfo.updateOne({ userId: TESTER_USER_INFO.userId }, { staffInfo: staffInfo._id });
    });

    it("successfully deletes staff info", async () => {
        const response = await delAsAdmin("/staff/info/").send({ userId: TESTER_USER_INFO.userId }).expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({ success: true });

        const userInfo = await Models.UserInfo.findOne({ userId: TESTER_USER_INFO.userId });
        expect(userInfo?.staffInfo).toBeUndefined();

        const staffInfo = await Models.StaffInfo.findOne({ user: userInfo!._id });
        expect(staffInfo).toBeNull();
    });

    it("returns error when user does not exist", async () => {
        const response = await delAsAdmin("/staff/info/")
            .send({ userId: "nonexistent123" })
            .expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toMatchObject({
            error: "NotFound",
        });
    });

    it("returns error when staff info does not exist", async () => {
        const response = await delAsAdmin("/staff/info/")
            .send({ userId: INACTIVE_STAFF_USER.userId })
            .expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toMatchObject({
            error: "StaffNotFound",
        });
    });

    it("rejects non-admin users", async () => {
        await delAsAttendee("/staff/info/").send({ userId: TESTER_USER_INFO.userId }).expect(StatusCode.ClientErrorForbidden);
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
        testUserId = TESTER_REGISTRATION.userId;
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
            dietaryRestrictions: TESTER_REGISTRATION.dietaryRestrictions,
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

    it("handles missing registration data", async () => {
        // Remove registration data
        await Models.RegistrationApplicationSubmitted.deleteOne({ userId: testUserId });

        await putAsStaff("/staff/scan-attendee/")
            .send({ eventId: TEST_EVENT.eventId, attendeeQRCode: validAttendeeQRCode })
            .expect(StatusCode.ServerErrorInternal);
    });
});
