import { beforeEach, describe, expect, it } from "@jest/globals";
import { get, getAsAttendee, getAsAdmin } from "../../common/testTools";
import { Role } from "../auth/auth-schemas";
import { StatusCode } from "status-code-enum";
import Models from "../../common/models";
import { StaffInfo } from "../staff/staff-schemas";

const ACCEPTED_USER_1 = {
    userId: "user1",
    email: "shlong@hackillinois.com",
    firstName: "shlong",
    lastName: "shlong",
    school: "University of Illinois",
    education: "Undergraduate",
    major: "Computer Science",
    gradYear: 2027,
    degree: "Bachelor's",
    graduate: false,
    age: 21,
    phoneNumber: "1234567890",
    gender: "Female",
    country: "USA",
    underrepresented: false,
    hackathonsParticipated: 2,
    application1: "Answer 1",
    application2: "Answer 2",
    application3: "Answer 3",
    requestTravelReimbursement: false,
    mlhNewsletter: true,
};

const ACCEPTED_USER_2 = {
    userId: "user2",
    email: "user2@example.com",
    firstName: "Jane",
    lastName: "Smith",
    school: "MIT",
    education: "Graduate",
    major: "Electrical Engineering",
    gradYear: 2024,
    degree: "Master's",
    graduate: true,
    age: 24,
    phoneNumber: "0987654321",
    gender: "Female",
    country: "USA",
    underrepresented: true,
    hackathonsParticipated: 5,
    application1: "Answer 1",
    application2: "Answer 2",
    application3: "Answer 3",
    requestTravelReimbursement: true,
    mlhNewsletter: false,
};

const ACCEPTED_USER_3 = {
    userId: "user3",
    email: "user3@example.com",
    firstName: "Bob",
    lastName: "Johnson",
    school: "Stanford",
    education: "Undergraduate",
    major: "Mechanical Engineering",
    gradYear: 2026,
    degree: "Bachelor's",
    graduate: false,
    age: 20,
    phoneNumber: "5555555555",
    gender: "Male",
    country: "Canada",
    underrepresented: false,
    hackathonsParticipated: 1,
    application1: "Answer 1",
    application2: "Answer 2",
    application3: "Answer 3",
    requestTravelReimbursement: false,
    mlhNewsletter: true,
};

const REJECTED_USER = {
    userId: "user4",
    email: "user4@example.com",
    firstName: "Rejected",
    lastName: "User",
    school: "Some School",
    education: "Undergraduate",
    major: "Biology",
    gradYear: 2025,
    degree: "Bachelor's",
    graduate: false,
    age: 22,
    phoneNumber: "1111111111",
    gender: "Other",
    country: "USA",
    underrepresented: false,
    hackathonsParticipated: 0,
    application1: "Answer 1",
    application2: "Answer 2",
    application3: "Answer 3",
    requestTravelReimbursement: false,
    mlhNewsletter: false,
};

const ACTIVE_STAFF = {
    firstName: "Active",
    lastName: "Staff",
    title: "Engineering Lead",
    isActive: true,
    email: "active@hackillinois.org",
    staffEmail: "active@hackillinois.org",
    school: "University of Illinois",
    major: "Computer Science",
    education: "Undergraduate",
    graduate: "Fall 2025",
    userId: "staff-user-active",
} satisfies StaffInfo;

const INACTIVE_STAFF = {
    firstName: "Inactive",
    lastName: "Staff",
    title: "Former Lead",
    isActive: false,
    email: "inactive@hackillinois.org",
    staffEmail: "inactive@hackillinois.org",
    school: "University of Illinois",
    major: "Computer Science",
    education: "Undergraduate",
    graduate: "Fall 2024",
    userId: "staff-user-inactive",
} satisfies StaffInfo;

beforeEach(async () => {
    await Models.AdmissionDecision.create([
        { userId: "user1", response: "ACCEPTED", status: "ACCEPTED" },
        { userId: "user2", response: "ACCEPTED", status: "ACCEPTED" },
        { userId: "user3", response: "ACCEPTED", status: "ACCEPTED" },
        { userId: "user4", response: "REJECTED", status: "REJECTED" },
    ]);

    await Models.RegistrationApplicationSubmitted.create([ACCEPTED_USER_1, ACCEPTED_USER_2, ACCEPTED_USER_3, REJECTED_USER]);
    await Models.StaffInfo.deleteMany({});
});

describe("GET /sponsor/resumebook/all", () => {
    it("returns all accepted applicants when no staff exist", async () => {
        const response = await getAsAdmin("/sponsor/resumebook/all").expect(StatusCode.SuccessOK);

        const data = JSON.parse(response.text);
        expect(data).toHaveLength(3);

        const userIds = data.map((applicant: { userId: string }) => applicant.userId);
        expect(userIds).toContain("user1");
        expect(userIds).toContain("user2");
        expect(userIds).toContain("user3");
        expect(userIds).not.toContain("user4");
    });

    it("includes active staff members combined with accepted applicants", async () => {
        await Models.StaffInfo.create(ACTIVE_STAFF);

        const response = await getAsAdmin("/sponsor/resumebook/all").expect(StatusCode.SuccessOK);

        const data = JSON.parse(response.text);
        expect(data).toHaveLength(4);

        const userIds = data.map((entry: { userId: string }) => entry.userId);
        expect(userIds).toContain("user1");
        expect(userIds).toContain("user2");
        expect(userIds).toContain("user3");
        expect(userIds).toContain(ACTIVE_STAFF.userId);
        expect(userIds).not.toContain("user4");
    });

    it("does not include inactive staff members", async () => {
        await Models.StaffInfo.create([ACTIVE_STAFF, INACTIVE_STAFF]);

        const response = await getAsAdmin("/sponsor/resumebook/all").expect(StatusCode.SuccessOK);

        const data = JSON.parse(response.text);
        const userIds = data.map((entry: { userId: string }) => entry.userId);
        expect(userIds).toContain(ACTIVE_STAFF.userId);
        expect(userIds).not.toContain(INACTIVE_STAFF.userId);
    });

    it("returns correct fields for each applicant", async () => {
        const response = await getAsAdmin("/sponsor/resumebook/all").expect(StatusCode.SuccessOK);

        const data = JSON.parse(response.text);
        expect(data[0]).toHaveProperty("userId");
        expect(data[0]).toHaveProperty("email");
        expect(data[0]).toHaveProperty("firstName");
        expect(data[0]).toHaveProperty("lastName");
        expect(data[0]).toHaveProperty("school");
        expect(data[0]).toHaveProperty("education");
        expect(data[0]).toHaveProperty("major");
        expect(data[0]).not.toHaveProperty("_id");
    });

    it("returns correct fields for staff entries", async () => {
        await Models.StaffInfo.create(ACTIVE_STAFF);

        const response = await getAsAdmin("/sponsor/resumebook/all").expect(StatusCode.SuccessOK);

        const data = JSON.parse(response.text);
        const staffEntry = data.find((entry: { userId: string }) => entry.userId === ACTIVE_STAFF.userId);
        expect(staffEntry).toBeDefined();
        expect(staffEntry).toHaveProperty("userId", ACTIVE_STAFF.userId);
        expect(staffEntry).toHaveProperty("email", ACTIVE_STAFF.email);
        expect(staffEntry).toHaveProperty("firstName", ACTIVE_STAFF.firstName);
        expect(staffEntry).toHaveProperty("lastName", ACTIVE_STAFF.lastName);
        expect(staffEntry).toHaveProperty("school", ACTIVE_STAFF.school);
        expect(staffEntry).toHaveProperty("education", ACTIVE_STAFF.education);
        expect(staffEntry).toHaveProperty("major", ACTIVE_STAFF.major);
        expect(staffEntry).toHaveProperty("title", ACTIVE_STAFF.title);
        expect(staffEntry).not.toHaveProperty("_id");
    });

    it("returns empty array when no accepted applicants or active staff exist", async () => {
        await Models.AdmissionDecision.deleteMany({});
        await Models.RegistrationApplicationSubmitted.deleteMany({});

        const response = await getAsAdmin("/sponsor/resumebook/all").expect(StatusCode.SuccessOK);

        const data = JSON.parse(response.text);
        expect(data).toHaveLength(0);
    });

    it("returns only active staff when no accepted applicants exist", async () => {
        await Models.AdmissionDecision.deleteMany({});
        await Models.RegistrationApplicationSubmitted.deleteMany({});
        await Models.StaffInfo.create([ACTIVE_STAFF, INACTIVE_STAFF]);

        const response = await getAsAdmin("/sponsor/resumebook/all").expect(StatusCode.SuccessOK);

        const data = JSON.parse(response.text);
        expect(data).toHaveLength(1);
        expect(data[0].userId).toBe(ACTIVE_STAFF.userId);
    });

    it("rejects non-sponsor users", async () => {
        await getAsAttendee("/sponsor/resumebook/all").expect(StatusCode.ClientErrorForbidden);
    });

    it("allows sponsor users", async () => {
        await Models.StaffInfo.create(ACTIVE_STAFF);

        const response = await get("/sponsor/resumebook/all", Role.SPONSOR).expect(StatusCode.SuccessOK);

        const data = JSON.parse(response.text);
        expect(data).toHaveLength(4);
    });

    it("allows admin users", async () => {
        const response = await getAsAdmin("/sponsor/resumebook/all").expect(StatusCode.SuccessOK);

        const data = JSON.parse(response.text);
        expect(data).toHaveLength(3);
    });
});
