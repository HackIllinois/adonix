import { beforeEach, describe, expect, it } from "@jest/globals";
import { getAsAttendee, getAsAdmin } from "../../common/testTools";
import { StatusCode } from "status-code-enum";
import Models from "../../common/models";

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

beforeEach(async () => {
    await Models.AdmissionDecision.create([
        { userId: "user1", response: "ACCEPTED", status: "ACCEPTED" },
        { userId: "user2", response: "ACCEPTED", status: "ACCEPTED" },
        { userId: "user3", response: "ACCEPTED", status: "ACCEPTED" },
        { userId: "user4", response: "REJECTED", status: "REJECTED" },
    ]);

    await Models.RegistrationApplicationSubmitted.create([ACCEPTED_USER_1, ACCEPTED_USER_2, ACCEPTED_USER_3, REJECTED_USER]);
});

describe("GET /sponsor/resumebook/all", () => {
    it("returns all accepted applicants without pagination", async () => {
        const response = await getAsAdmin("/sponsor/resumebook/all").expect(StatusCode.SuccessOK);

        const data = JSON.parse(response.text);
        expect(data).toHaveLength(3);

        const userIds = data.map((applicant: { userId: string }) => applicant.userId);
        expect(userIds).toContain("user1");
        expect(userIds).toContain("user2");
        expect(userIds).toContain("user3");
        expect(userIds).not.toContain("user4");
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

    it("returns empty array when no accepted applicants exist", async () => {
        await Models.AdmissionDecision.deleteMany({});
        await Models.RegistrationApplicationSubmitted.deleteMany({});

        const response = await getAsAdmin("/sponsor/resumebook/all").expect(StatusCode.SuccessOK);

        const data = JSON.parse(response.text);
        expect(data).toHaveLength(0);
    });

    it("rejects non-sponsor users", async () => {
        await getAsAttendee("/sponsor/resumebook/all").expect(StatusCode.ClientErrorForbidden);
    });

    it("allows admin users", async () => {
        const response = await getAsAdmin("/sponsor/resumebook/all").expect(StatusCode.SuccessOK);

        const data = JSON.parse(response.text);
        expect(data).toHaveLength(3);
    });
});
