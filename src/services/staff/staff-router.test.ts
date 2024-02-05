import { beforeEach, describe, expect, it } from "@jest/globals";
import { AUTH_ROLE_TO_ROLES, putAsAttendee, putAsStaff } from "../../testTools.js";
import { generateJwtToken } from "../auth/auth-lib.js";

import { EventAttendance } from "database/event-db.js";
import { StatusCode } from "status-code-enum";
import Models from "../../database/models.js";
import { RegistrationApplication } from "database/registration-db.js";

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
    degree: "Associates' Degree",
    university: "University of Illinois (Chicago)",
    major: "Computer Science",
    minor: "Computer Science",
    gradYear: 2030,
    hackEssay1: "yay",
    hackEssay2: "yay",
    proEssay: "",
    hackInterest: ["Attending technical workshops"],
    hackOutreach: ["Instagram"],
    dietaryRestrictions: ["None"],
    resumeFileName: "GitHub cheatsheet.pdf",
    isProApplicant: false,
    legalName: "Ronakin Kanandani",
    considerForGeneral: false,
    requestedTravelReimbursement: true,
    gender: "Prefer Not To Answer",
    race: ["Prefer Not To Answer"],
    optionalEssay: "Optional Essay",
} satisfies RegistrationApplication;

// Before each test, initialize database with Event in EventAttendance
beforeEach(async () => {
    await Models.EventAttendance.create(TESTER_EVENT_ATTENDANCE);
    await Models.RegistrationApplication.create(TESTER_REGISTRATION);
});

describe("PUT /staff/scan-attendee/", () => {
    const attendeeJWT = generateJwtToken({
        id: TESTER_REGISTRATION.userId,
        email: "irrelevant@gmail.com",
        provider: "github",
        roles: AUTH_ROLE_TO_ROLES["ATTENDEE"],
    });

    it("works for a staff", async () => {
        await putAsStaff("/staff/scan-attendee/")
            .send({ eventId: "some-event", attendeeJWT: attendeeJWT as string })
            .expect(StatusCode.SuccessOK);

        const eventAttendance = await Models.EventAttendance.findOne({ eventId: "some-event" });
        const userAttendance = await Models.UserAttendance.findOne({ userId: "some-user" });

        expect(eventAttendance?.attendees).toContain("some-user");
        expect(userAttendance?.attendance).toContain("some-event");
    });

    it("returns Forbidden for non-staff", async () => {
        const response = await putAsAttendee("/staff/scan-attendee/")
            .send({ eventId: "some-event", attendeeJWT: attendeeJWT as string })
            .expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("returns InvalidParams for missing parameters", async () => {
        const response = await putAsStaff("/staff/scan-attendee/").send({}).expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "InvalidParams");
    });

    it("returns EventNotFound for non-existent event", async () => {
        const response = await putAsStaff("/staff/scan-attendee/")
            .send({ eventId: "not-some-event", attendeeJWT: attendeeJWT as string })
            .expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "EventNotFound");
    });

    it("returns AlreadyCheckedIn for duplicate calls", async () => {
        await putAsStaff("/staff/scan-attendee/")
            .send({ eventId: "some-event", attendeeJWT: attendeeJWT as string })
            .expect(StatusCode.SuccessOK);

        const response = await putAsStaff("/staff/scan-attendee/")
            .send({ eventId: "some-event", attendeeJWT: attendeeJWT as string })
            .expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "AlreadyCheckedIn");
    });
});
