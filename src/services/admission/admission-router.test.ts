import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import Models from "../../common/models";
import { DecisionStatus, DecisionResponse, AdmissionDecision } from "./admission-schemas";
import { Templates } from "../../common/config";
import { RegistrationApplicationSubmitted } from "../registration/registration-schemas";
import { getAsStaff, getAsUser, putAsStaff, putAsUser, getAsAttendee, putAsApplicant, TESTER } from "../../common/testTools";
import { StatusCode } from "status-code-enum";
import type * as MailLib from "../../services/mail/mail-lib";
import { BulkMailInfo, MailInfo } from "../mail/mail-schemas";
import { AttendeeProfileCreateRequest } from "../profile/profile-schemas";

const TESTER_DECISION = {
    userId: TESTER.id,
    status: DecisionStatus.ACCEPTED,
    response: DecisionResponse.PENDING,
    emailSent: false,
    admittedPro: false,
    reimbursementValue: 0,
    correctProChallenge: false,
} satisfies AdmissionDecision;

const OTHER_DECISION = {
    userId: "other-user",
    status: DecisionStatus.REJECTED,
    response: DecisionResponse.DECLINED,
    emailSent: true,
    admittedPro: false,
    reimbursementValue: 0,
    correctProChallenge: false,
} satisfies AdmissionDecision;

const TESTER_APPLICATION = {
    userId: TESTER.id,
    firstName: TESTER.name,
    lastName: TESTER.name,
    age: "21",
    email: TESTER.email,
    phoneNumber: TESTER.phoneNumber,
    gender: "Other",
    race: ["Prefer Not to Answer"],
    country: "United States",
    state: "Illinois",
    school: "University of Illinois Urbana-Champaign",
    education: "Undergraduate University (3+ year)",
    graduate: "Spring 2026",
    major: "Computer Science",
    underrepresented: "No",
    hackathonsParticipated: "2-3",
    application1: "I love hack",
    application2: "I love hack",
    application3: "I love hack",
    applicationOptional: "optional essay",
    pro: true,
    attribution: ["Word of Mouth", "Instagram"],
    eventInterest: ["Meeting New People"],
    requestTravelReimbursement: false,
    mlhNewsletter: true,
} satisfies RegistrationApplicationSubmitted;

const CREATE_REQUEST = {
    avatarId: TESTER.avatarId,
    displayName: TESTER.name,
    discordTag: TESTER.discordTag,
    dietaryRestrictions: ["Peanut Allergy"],
    shirtSize: "M",
} satisfies AttendeeProfileCreateRequest;

const updateRequest = [
    {
        userId: TESTER.id,
        status: DecisionStatus.ACCEPTED,
        response: DecisionResponse.PENDING,
        admittedPro: true,
        reimbursementValue: 12,
    },
];

beforeEach(async () => {
    await Models.AdmissionDecision.create(TESTER_DECISION);
    await Models.AdmissionDecision.create(OTHER_DECISION);
    await Models.RegistrationApplicationSubmitted.create(TESTER_APPLICATION);
});

describe("GET /admission/notsent/", () => {
    it("gives forbidden error for user without elevated perms", async () => {
        const responseUser = await getAsUser("/admission/notsent/").expect(StatusCode.ClientErrorForbidden);
        expect(JSON.parse(responseUser.text)).toHaveProperty("error", "Forbidden");
    });
    it("should return a list of applicants without email sent", async () => {
        const response = await getAsStaff("/admission/notsent/").expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject(expect.arrayContaining([expect.objectContaining(TESTER_DECISION)]));
    });
});

function mockSendMail(): jest.SpiedFunction<typeof MailLib.sendMail> {
    const mailLib = require("../../services/mail/mail-lib") as typeof MailLib;
    return jest.spyOn(mailLib, "sendMail");
}

function mockSendBulkMail(): jest.SpiedFunction<typeof MailLib.sendBulkMail> {
    const mailLib = require("../../services/mail/mail-lib") as typeof MailLib;
    return jest.spyOn(mailLib, "sendBulkMail");
}

describe("PUT /admission/update/", () => {
    let sendMail: jest.SpiedFunction<typeof MailLib.sendMail> = undefined!;
    let sendBulkMail: jest.SpiedFunction<typeof MailLib.sendBulkMail> = undefined!;

    beforeEach(async () => {
        // Mock successful send by default
        sendMail = mockSendMail();
        sendMail.mockImplementation(async (_) => ({
            messageId: "test-message-id",
        }));

        sendBulkMail = mockSendBulkMail();
        sendBulkMail.mockImplementation(async (_) => {});
    });

    it("gives forbidden error for user without elevated perms", async () => {
        const responseUser = await putAsUser("/admission/update/").send(updateRequest).expect(StatusCode.ClientErrorForbidden);
        expect(JSON.parse(responseUser.text)).toHaveProperty("error", "Forbidden");
    });

    it("should update application status of applicants", async () => {
        await Models.AdmissionDecision.findOneAndUpdate({ userId: TESTER_DECISION.userId }, { status: DecisionStatus.TBD });

        const response = await putAsStaff("/admission/update/").send(updateRequest).expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toEqual({ success: true });

        const ops = updateRequest.map((entry) => Models.AdmissionDecision.findOne({ userId: entry.userId }));
        const retrievedEntries = await Promise.all(ops);

        expect(sendBulkMail).toBeCalledWith({
            templateId: Templates.STATUS_UPDATE,
            defaultTemplateData: { status: DecisionStatus.TBD, reimbursementValue: 0, admittedPro: false },
            recipientIds: [
                {
                    email: TESTER_APPLICATION.email,
                    data: { status: DecisionStatus.ACCEPTED, reimbursementValue: 12, admittedPro: true },
                },
            ],
        } satisfies BulkMailInfo);

        expect(retrievedEntries).toMatchObject(
            expect.arrayContaining(
                updateRequest.map((item) => expect.objectContaining({ status: item.status, userId: item.userId })),
            ),
        );
    });
});

describe("GET /admission/rsvp/", () => {
    it("gives a DecisionNotFound error for an non-existent user", async () => {
        await Models.AdmissionDecision.deleteOne({
            userId: TESTER.id,
        });

        const response = await getAsAttendee("/admission/rsvp/").expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "DecisionNotFound");
    });

    it("works for an attendee user and returns filtered data", async () => {
        const response = await getAsAttendee("/admission/rsvp/").expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({
            userId: TESTER_DECISION.userId,
            status: TESTER_DECISION.status,
            response: TESTER_DECISION.response,
        });
    });
});
describe("GET /admission/rsvp/staff/", () => {
    it("gives forbidden error for user without elevated perms", async () => {
        const responseUser = await getAsUser("/admission/rsvp/staff/")
            .send(updateRequest)
            .expect(StatusCode.ClientErrorForbidden);
        expect(JSON.parse(responseUser.text)).toHaveProperty("error", "Forbidden");
    });

    it("works for a staff user and returns unfiltered data", async () => {
        const response = await getAsStaff("/admission/rsvp/staff/").expect(StatusCode.SuccessOK);

        // expect(JSON.parse(response.text)).toMatchObject(TESTER_DECISION);
        expect(JSON.parse(response.text)).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    // Specify the properties of AdmissionDecision since its an array of custom model
                    userId: expect.any(String),
                    status: expect.any(String),
                    response: expect.any(String),
                    admittedPro: expect.any(Boolean),
                    emailSent: expect.any(Boolean),
                    reimbursementValue: expect.any(Number),
                }),
            ]),
        );
    });
});

describe("GET /admission/rsvp/:id", () => {
    it("returns forbidden error if caller doesn't have elevated perms", async () => {
        const response = await getAsAttendee(`/admission/rsvp/${TESTER.id}`).expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("gets if caller has elevated perms", async () => {
        const response = await getAsStaff(`/admission/rsvp/${TESTER.id}`).expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject(TESTER_DECISION);
    });

    it("returns DecisionNotFound error if user doesn't exist", async () => {
        const response = await getAsStaff("/admission/rsvp/idontexist").expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "DecisionNotFound");
    });
});

describe("PUT /admission/accept/", () => {
    let sendMail: jest.SpiedFunction<typeof MailLib.sendMail> = undefined!;

    beforeEach(async () => {
        // Mock successful send by default
        sendMail = mockSendMail();
        sendMail.mockImplementation(async (_) => ({
            messageId: "test-message-id",
        }));
    });

    it("returns DecisionNotFound for nonexistent user", async () => {
        await Models.AdmissionDecision.deleteOne({
            userId: TESTER.id,
        });

        const response = await putAsApplicant("/admission/accept/").send(CREATE_REQUEST).expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "DecisionNotFound");
    });

    it("lets applicant accept accepted decision", async () => {
        await putAsApplicant("/admission/accept/").send(CREATE_REQUEST).expect(StatusCode.SuccessOK);
        const stored = await Models.AdmissionDecision.findOne({ userId: TESTER.id });

        expect(sendMail).toBeCalledWith({
            templateId: Templates.RSVP_CONFIRMATION,
            recipient: TESTER_APPLICATION.email,
            templateData: { name: TESTER_APPLICATION.firstName },
        } satisfies MailInfo);

        expect(stored).toMatchObject({
            ...TESTER_DECISION,
            response: DecisionResponse.ACCEPTED,
        } satisfies AdmissionDecision);
    });

    it("doesn't let applicant accept rejected decision", async () => {
        await Models.AdmissionDecision.findOneAndUpdate({ userId: TESTER.id }, { status: DecisionStatus.REJECTED });

        const response = await putAsApplicant("/admission/accept/").send(CREATE_REQUEST).expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NotAccepted");
    });
    it("does not let applicant re-rsvp twice", async () => {
        await Models.AdmissionDecision.findOneAndUpdate(
            { userId: TESTER.id },
            { status: DecisionStatus.ACCEPTED, response: DecisionResponse.DECLINED },
        );

        const response = await putAsApplicant("/admission/accept/").send(CREATE_REQUEST).expect(StatusCode.ClientErrorConflict);
        expect(JSON.parse(response.text)).toHaveProperty("error", "AlreadyRSVPed");
    });

    it("does not let applicant accept with empty or incomplete profile data", async () => {
        await putAsApplicant("/admission/accept/").expect(StatusCode.ClientErrorBadRequest);
        await putAsApplicant("/admission/accept/").send({ displayName: "Bob" }).expect(StatusCode.ClientErrorBadRequest);
    });
});

describe("PUT /admission/decline/", () => {
    let sendMail: jest.SpiedFunction<typeof MailLib.sendMail> = undefined!;

    beforeEach(async () => {
        // Mock successful send by default
        sendMail = mockSendMail();
        sendMail.mockImplementation(async (_) => ({
            messageId: "test-message-id",
        }));
    });

    it("returns DecisionNotFound for nonexistent user", async () => {
        await Models.AdmissionDecision.deleteOne({
            userId: TESTER.id,
        });

        const response = await putAsApplicant("/admission/decline/").expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "DecisionNotFound");
    });

    it("lets applicant decline accepted decision", async () => {
        await putAsApplicant("/admission/decline/").expect(StatusCode.SuccessOK);
        const stored = await Models.AdmissionDecision.findOne({ userId: TESTER.id });

        expect(sendMail).toBeCalledWith({
            templateId: Templates.RSVP_DECLINED,
            recipient: TESTER_APPLICATION.email,
        } satisfies MailInfo);

        expect(stored).toMatchObject({
            ...TESTER_DECISION,
            response: DecisionResponse.DECLINED,
        } satisfies AdmissionDecision);
    });

    it("doesn't let applicant accept rejected decision", async () => {
        await Models.AdmissionDecision.findOneAndUpdate({ userId: TESTER.id }, { status: DecisionStatus.REJECTED });

        const response = await putAsApplicant("/admission/decline/").expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NotAccepted");
    });

    it("does not let applicant re-rsvp twice", async () => {
        await Models.AdmissionDecision.findOneAndUpdate(
            { userId: TESTER.id },
            { status: DecisionStatus.ACCEPTED, response: DecisionResponse.DECLINED },
        );

        const response = await putAsApplicant("/admission/decline/").expect(StatusCode.ClientErrorConflict);
        expect(JSON.parse(response.text)).toHaveProperty("error", "AlreadyRSVPed");
    });
});
