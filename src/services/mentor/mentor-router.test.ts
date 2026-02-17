import { describe, expect, it } from "@jest/globals";
import Models from "../../common/models";
import { StatusCode } from "status-code-enum";
import { postAsAdmin, postAsAttendee, getAsAttendee, delAsAttendee, delAsAdmin } from "../../common/testTools";
import { MentorOfficeHours } from "./mentor-schemas";

const TESTER_OFFICE_HOURS_1 = {
    mentorName: "asdf",
    mentorId: "io213123012",
    location: "Siebel 2407",
    startTime: 1707235200,
    endTime: 1707238800,
    attendees: [],
} satisfies MentorOfficeHours;

const TESTER_OFFICE_HOURS_2 = {
    mentorName: "3211",
    mentorId: "2k2kk3mmn3",
    location: "ECEB 3017",
    startTime: 1707242400,
    endTime: 1707246000,
    attendees: [],
} satisfies MentorOfficeHours;

describe("POST /mentor", () => {
    it("gives an invalid perms error for a non-staff user", async () => {
        const response = await postAsAttendee(`/mentor/`)
            .send({
                mentorName: "John Sanson",
                location: "Siebel 2407",
                startTime: 1707235200,
                endTime: 1707238800,
            })
            .expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("works for staff", async () => {
        const response = await postAsAdmin(`/mentor/`)
            .send({
                mentorName: "John Sanson",
                location: "Siebel 2407",
                startTime: 1707235200,
                endTime: 1707238800,
            })
            .expect(StatusCode.SuccessCreated);

        const body = JSON.parse(response.text);
        expect(body).toHaveProperty("mentorName", "John Sanson");
        expect(body).toHaveProperty("location", "Siebel 2407");
        expect(body).toHaveProperty("startTime", 1707235200);
        expect(body).toHaveProperty("endTime", 1707238800);
        expect(body).toHaveProperty("mentorId");
    });
});

describe("GET /mentor", () => {
    it("works for attendees", async () => {
        await Models.MentorOfficeHours.create(TESTER_OFFICE_HOURS_1);
        await Models.MentorOfficeHours.create(TESTER_OFFICE_HOURS_2);

        const response = await getAsAttendee(`/mentor/`).expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject([TESTER_OFFICE_HOURS_1, TESTER_OFFICE_HOURS_2]);
    });
});

describe("DELETE /mentor/id/", () => {
    it("gives an invalid perms error for a non-staff user", async () => {
        const response = await delAsAttendee(`/mentor/${TESTER_OFFICE_HOURS_1.mentorId}/`).expect(
            StatusCode.ClientErrorForbidden,
        );

        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("gives a not found error for a nonexistent mentor", async () => {
        const response = await delAsAdmin(`/mentor/${TESTER_OFFICE_HOURS_1.mentorId}/`).expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NotFound");
    });

    it("works for staff", async () => {
        await Models.MentorOfficeHours.create(TESTER_OFFICE_HOURS_1);

        await delAsAdmin(`/mentor/${TESTER_OFFICE_HOURS_1.mentorId}/`).expect(StatusCode.SuccessOK);

        const officeHours = await Models.MentorOfficeHours.findOne({ mentorId: TESTER_OFFICE_HOURS_1.mentorId });
        expect(officeHours).toBeNull();
    });
});

describe("POST /mentor/attendance", () => {
    it("gives an invalid perms error for a non-attendee user", async () => {
        await Models.MentorOfficeHours.create(TESTER_OFFICE_HOURS_1);

        const response = await postAsAdmin(`/mentor/attendance`)
            .send({ mentorId: TESTER_OFFICE_HOURS_1.mentorId })
            .expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("gives a not found error for a nonexistent mentor", async () => {
        const response = await postAsAttendee(`/mentor/attendance`)
            .send({ mentorId: "dne" })
            .expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NotFound");
    });

    it("gives an already checked in error if an attendee tries to check in twice", async () => {
        await Models.MentorOfficeHours.create(TESTER_OFFICE_HOURS_1);

        await postAsAttendee(`/mentor/attendance`)
            .send({ mentorId: TESTER_OFFICE_HOURS_1.mentorId })
            .expect(StatusCode.SuccessOK);

        const response = await postAsAttendee(`/mentor/attendance`)
            .send({ mentorId: TESTER_OFFICE_HOURS_1.mentorId })
            .expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "AlreadyCheckedIn");
    });

    it("works for attendee", async () => {
        await Models.MentorOfficeHours.create(TESTER_OFFICE_HOURS_1);

        await postAsAttendee(`/mentor/attendance/`)
            .send({ mentorId: TESTER_OFFICE_HOURS_1.mentorId })
            .expect(StatusCode.SuccessOK);

        const officeHours = await Models.MentorOfficeHours.findOne({ mentorId: TESTER_OFFICE_HOURS_1.mentorId });

        expect(officeHours?.attendees).toContain("bob-the-tester101010101011");
    });
});
