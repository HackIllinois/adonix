import { describe, expect, it } from "@jest/globals";
//import { AttendeeFollowing } from "../../database/attendee-db.js";
import Models from "../../database/models.js";
import { StatusCode } from "status-code-enum";
import { OfficeHoursFormat } from "./mentor-formats.js";
import { postAsAdmin, postAsAttendee, getAsAttendee, getAsAdmin, delAsAttendee, delAsAdmin } from "../../testTools.js";

const TESTER_OFFICE_HOURS_1 = {
    mentorName: "asdf",
    mentorId: "io213123012",
    attendees: [],
} satisfies OfficeHoursFormat;

const TESTER_OFFICE_HOURS_2 = {
    mentorName: "3211",
    mentorId: "2k2kk3mmn3",
    attendees: [],
} satisfies OfficeHoursFormat;

describe("POST /mentor", () => {
    it("gives an invalid perms error for a non-staff user", async () => {
        const response = await postAsAttendee(`/mentor/`)
            .send({ mentorName: "John Sanson" })
            .expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "InvalidPermission");
    });

    it("gives a bad request error for missing fields", async () => {
        const response = await postAsAttendee(`/mentor/`).send({}).expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "InvalidRequest");
    });

    it("works for staff", async () => {
        const response = await postAsAdmin(`/mentor/`).send({ mentorName: "John Sanson" }).expect(StatusCode.SuccessCreated);

        expect(JSON.parse(response.text)).toHaveProperty("mentorName", "John Sanson");
        //mentorId will be randomly generated, and attendees will be empty after initialization
    });
});

describe("GET /mentor", () => {
    it("gives an invalid perms error for a non-staff user", async () => {
        const response = await getAsAttendee(`/mentor/`)
            .send({ mentorName: "John Sanson" })
            .expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "InvalidPermission");
    });

    it("works for staff", async () => {
        await Models.MentorOfficeHours.create(TESTER_OFFICE_HOURS_1);
        await Models.MentorOfficeHours.create(TESTER_OFFICE_HOURS_2);

        const response = await getAsAdmin(`/mentor/`).expect(StatusCode.SuccessOK);

        console.log(response);

        expect(JSON.parse(response.text)).toMatchObject([TESTER_OFFICE_HOURS_1, TESTER_OFFICE_HOURS_2]);
    });
});

describe("DELETE /mentor", () => {
    it("gives an invalid perms error for a non-staff user", async () => {
        const response = await delAsAttendee(`/mentor/`).send({ mentorId: "12312312" }).expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "InvalidPermission");
    });

    it("gives a bad request error for missing fields", async () => {
        const response = await delAsAdmin(`/mentor/`).send({}).expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "InvalidRequest");
    });

    it("gives a not found error for a nonexistent mentor", async () => {
        const response = await delAsAdmin(`/mentor/`).send({ mentorId: "dne" }).expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "MentorNotFound");
    });

    it("works for staff", async () => {
        await Models.MentorOfficeHours.create(TESTER_OFFICE_HOURS_1);

        await delAsAdmin(`/mentor/`).send({ mentorId: "io213123012" }).expect(StatusCode.SuccessOK);

        const officeHours: OfficeHoursFormat | null = await Models.MentorOfficeHours.findOne({ mentorId: "io213123012" });
        expect(officeHours).toBeNull();
    });
});

describe("POST /mentor/attendance", () => {
    it("gives an invalid perms error for a non-attendee user", async () => {
        await Models.MentorOfficeHours.create(TESTER_OFFICE_HOURS_1);

        const response = await postAsAdmin(`/mentor/attendance`)
            .send({ mentorId: "io213123012" })
            .expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "InvalidPermission");
    });

    it("gives a bad request error for missing fields", async () => {
        const response = await postAsAttendee(`/mentor/attendance`).send({}).expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "InvalidRequest");
    });

    it("gives a not found error for a nonexistent mentor", async () => {
        const response = await postAsAttendee(`/mentor/attendance`)
            .send({ mentorId: "dne" })
            .expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "MentorNotFound");
    });

    it("gives an already checked in error if an attendee tries to check in twice", async () => {
        await Models.MentorOfficeHours.create(TESTER_OFFICE_HOURS_1);

        await postAsAttendee(`/mentor/attendance`).send({ mentorId: "io213123012" }).expect(StatusCode.SuccessOK);

        const response = await postAsAttendee(`/mentor/attendance`)
            .send({ mentorId: "io213123012" })
            .expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "AlreadyCheckedIn");
    });

    it("works for attendee", async () => {
        await Models.MentorOfficeHours.create(TESTER_OFFICE_HOURS_1);

        await postAsAttendee(`/mentor/attendance/`).send({ mentorId: "io213123012" }).expect(StatusCode.SuccessOK);

        const officeHours: OfficeHoursFormat | null = await Models.MentorOfficeHours.findOne({ mentorId: "io213123012" });

        expect(officeHours?.attendees).toContain("bob-the-tester101010101011");
    });
});
