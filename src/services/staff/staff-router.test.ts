import { beforeEach, describe, expect, it } from "@jest/globals";
import { putAsAttendee, putAsStaff, TESTER } from "../../common/testTools";

import { Event, EventAttendance, EventType } from "../event/event-schemas";
import { StatusCode } from "status-code-enum";
import Models from "../../common/models";
import { Degree, Gender, HackInterest, HackOutreach, Race, RegistrationApplication } from "../registration/registration-schemas";
import { AttendeeProfile } from "../profile/profile-schemas";
import { generateQRCode } from "../user/user-lib";

const TESTER_EVENT_ATTENDANCE = {
    eventId: "some-event",
    attendees: [],
    excusedAttendees: [],
} satisfies EventAttendance;

const TESTER_REGISTRATION = {
    userId: "some-user",
    hasSubmitted: true,
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
} satisfies RegistrationApplication;

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

// Before each test, initialize database with Event in EventAttendance
beforeEach(async () => {
    await Models.EventAttendance.create(TESTER_EVENT_ATTENDANCE);
    await Models.RegistrationApplication.create(TESTER_REGISTRATION);
    await Models.AttendeeProfile.create(TESTER_PROFILE);
    await Models.Event.create(TEST_EVENT);
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
        await Models.RegistrationApplication.deleteOne({ userId: testUserId });

        await putAsStaff("/staff/scan-attendee/")
            .send({ eventId: TEST_EVENT.eventId, attendeeQRCode: validAttendeeQRCode })
            .expect(StatusCode.ServerErrorInternal);
    });
});
