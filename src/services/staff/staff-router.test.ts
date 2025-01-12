import { beforeEach, describe, expect, it } from "@jest/globals";
import { AUTH_ROLE_TO_ROLES, putAsAttendee, putAsStaff } from "../../common/testTools";
import { generateJwtToken } from "../../common/auth";

import { Event, EventAttendance, EventType } from "../event/event-schemas";
import { StatusCode } from "status-code-enum";
import Models from "../../common/models";
import { Degree, Gender, HackInterest, HackOutreach, Race, RegistrationApplication } from "../registration/registration-schemas";
import { AttendeeProfile } from "../profile/profile-schemas";

const TESTER_EVENT_ATTENDANCE = {
    eventId: "some-event",
    attendees: [],
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
    avatarUrl: "TestURL",
    discordTag: "TestTag",
    points: 0,
    coins: 0,
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
            tags: [],
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
    const attendeeJWT = generateJwtToken({
        id: TESTER_REGISTRATION.userId,
        email: "irrelevant@gmail.com",
        provider: "github",
        roles: AUTH_ROLE_TO_ROLES["ATTENDEE"],
    });

    it("works for a staff", async () => {
        const response = await putAsStaff("/staff/scan-attendee/")
            .send({ eventId: TEST_EVENT.eventId, attendeeJWT })
            .expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({
            success: true,
            userId: TESTER_REGISTRATION.userId,
            dietaryRestrictions: TESTER_REGISTRATION.dietaryRestrictions,
        });

        const eventAttendance = await Models.EventAttendance.findOne({ eventId: "some-event" });
        const userAttendance = await Models.UserAttendance.findOne({ userId: "some-user" });

        expect(eventAttendance?.attendees).toContain("some-user");
        expect(userAttendance?.attendance).toContain(TEST_EVENT.eventId);
    });

    it("returns Forbidden for non-staff", async () => {
        const response = await putAsAttendee("/staff/scan-attendee/")
            .send({ eventId: TEST_EVENT.eventId, attendeeJWT })
            .expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("returns NotFound for non-existent event", async () => {
        const response = await putAsStaff("/staff/scan-attendee/")
            .send({ eventId: "not-some-event", attendeeJWT })
            .expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NotFound");
    });

    it("returns AlreadyCheckedIn for duplicate calls", async () => {
        await putAsStaff("/staff/scan-attendee/").send({ eventId: TEST_EVENT.eventId, attendeeJWT }).expect(StatusCode.SuccessOK);

        const response = await putAsStaff("/staff/scan-attendee/")
            .send({ eventId: TEST_EVENT.eventId, attendeeJWT })
            .expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "AlreadyCheckedIn");
    });
});
