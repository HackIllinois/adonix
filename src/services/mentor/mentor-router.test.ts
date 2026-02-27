import { describe, expect, it } from "@jest/globals";
import Models from "../../common/models";
import { StatusCode } from "status-code-enum";
import {
    postAsAdmin,
    postAsAttendee,
    getAsAttendee,
    delAsAttendee,
    delAsAdmin,
    putAsAdmin,
    putAsAttendee,
} from "../../common/testTools";
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

const TESTER_MENTOR_1 = {
    mentorId: "mentor-a",
    name: "Ada Lovelace",
    description: "Can help with algorithms and systems design.",
};

const TESTER_MENTOR_2 = {
    mentorId: "mentor-b",
    name: "Grace Hopper",
    description: "Can help with compilers and debugging.",
};

describe("POST /mentor/info", () => {
    it("gives an invalid perms error for a non-staff user", async () => {
        const response = await postAsAttendee(`/mentor/info/`)
            .send({
                name: "John Sanson",
                description: "Test description",
            })
            .expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("works for staff", async () => {
        const response = await postAsAdmin(`/mentor/info/`)
            .send({
                name: "John Sanson",
                description: "I can help with React and TypeScript.",
            })
            .expect(StatusCode.SuccessCreated);

        const body = JSON.parse(response.text);
        expect(body).toHaveProperty("mentorId");
        expect(body).toHaveProperty("name", "John Sanson");
        expect(body).toHaveProperty("description", "I can help with React and TypeScript.");
    });
});

describe("GET /mentor/info", () => {
    it("works for attendees and sorts mentors by name", async () => {
        await Models.MentorProfile.create(TESTER_MENTOR_2);
        await Models.MentorProfile.create(TESTER_MENTOR_1);

        const response = await getAsAttendee(`/mentor/info/`).expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject([TESTER_MENTOR_1, TESTER_MENTOR_2]);
    });
});

describe("PUT /mentor/info/id/", () => {
    it("gives a not found error for a nonexistent mentor", async () => {
        const response = await putAsAdmin(`/mentor/info/${TESTER_MENTOR_1.mentorId}/`)
            .send({
                name: "Updated Name",
                description: "Updated description",
            })
            .expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NotFound");
    });

    it("works for staff", async () => {
        await Models.MentorProfile.create(TESTER_MENTOR_1);

        const response = await putAsAdmin(`/mentor/info/${TESTER_MENTOR_1.mentorId}/`)
            .send({
                name: "Ada",
                description: "Updated bio",
            })
            .expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({
            mentorId: TESTER_MENTOR_1.mentorId,
            name: "Ada",
            description: "Updated bio",
        });
    });
});

describe("DELETE /mentor/info/id/", () => {
    it("gives an invalid perms error for a non-staff user", async () => {
        const response = await delAsAttendee(`/mentor/info/${TESTER_MENTOR_1.mentorId}/`).expect(StatusCode.ClientErrorForbidden);
        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("gives a not found error for a nonexistent mentor", async () => {
        const response = await delAsAdmin(`/mentor/info/${TESTER_MENTOR_1.mentorId}/`).expect(StatusCode.ClientErrorNotFound);
        expect(JSON.parse(response.text)).toHaveProperty("error", "NotFound");
    });

    it("works for staff", async () => {
        await Models.MentorProfile.create(TESTER_MENTOR_1);
        await delAsAdmin(`/mentor/info/${TESTER_MENTOR_1.mentorId}/`).expect(StatusCode.SuccessOK);

        const mentorProfile = await Models.MentorProfile.findOne({ mentorId: TESTER_MENTOR_1.mentorId });
        expect(mentorProfile).toBeNull();
    });
});

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

describe("PUT /mentor/id/", () => {
    it("gives an invalid perms error for a non-staff user", async () => {
        const response = await putAsAttendee(`/mentor/${TESTER_OFFICE_HOURS_1.mentorId}/`)
            .send({
                mentorName: "Updated",
                location: "ECEB 1002",
                startTime: 1707239999,
                endTime: 1707241111,
            })
            .expect(StatusCode.ClientErrorForbidden);
        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("gives a not found error for a nonexistent mentor", async () => {
        const response = await putAsAdmin(`/mentor/${TESTER_OFFICE_HOURS_1.mentorId}/`)
            .send({
                mentorName: "Updated",
                location: "ECEB 1002",
                startTime: 1707239999,
                endTime: 1707241111,
            })
            .expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NotFound");
    });

    it("works for staff", async () => {
        await Models.MentorOfficeHours.create(TESTER_OFFICE_HOURS_1);

        const response = await putAsAdmin(`/mentor/${TESTER_OFFICE_HOURS_1.mentorId}/`)
            .send({
                mentorName: "Updated Name",
                location: "ECEB 1002",
                startTime: 1707239999,
                endTime: 1707241111,
            })
            .expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({
            mentorId: TESTER_OFFICE_HOURS_1.mentorId,
            mentorName: "Updated Name",
            location: "ECEB 1002",
            startTime: 1707239999,
            endTime: 1707241111,
        });
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
