import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import Models from "../../database/models";
import { DecisionStatus, DecisionResponse, AdmissionDecision } from "../../database/admission-db";
import { RegistrationFormat } from "../registration/registration-formats";
import { RegistrationTemplates } from "../../common/config";
import { Gender, Degree, Race, HackInterest, HackOutreach } from "../registration/registration-models";
import { getAsStaff, getAsUser, putAsStaff, putAsUser, getAsAttendee, putAsApplicant, TESTER } from "../../common/testTools";
import { StatusCode } from "status-code-enum";
import type * as MailLib from "../../services/mail/mail-lib";
import type { AxiosResponse } from "axios";
import { MailInfo } from "../mail/mail-schemas";

const TESTER_DECISION = {
    userId: TESTER.id,
    status: DecisionStatus.ACCEPTED,
    response: DecisionResponse.PENDING,
    emailSent: false,
} satisfies AdmissionDecision;

const OTHER_DECISION = {
    userId: "other-user",
    status: DecisionStatus.REJECTED,
    response: DecisionResponse.DECLINED,
    emailSent: true,
} satisfies AdmissionDecision;

const TESTER_APPLICATION = {
    isProApplicant: false,
    userId: TESTER.id,
    preferredName: TESTER.name,
    legalName: TESTER.name,
    emailAddress: TESTER.email,
    university: "ap",
    hackEssay1: "ap",
    hackEssay2: "ap",
    optionalEssay: "ap",
    location: "ap",
    gender: Gender.OTHER,
    degree: Degree.BACHELORS,
    major: "CS",
    gradYear: 0,
    requestedTravelReimbursement: false,
    dietaryRestrictions: [],
    race: [Race.NO_ANSWER],
    hackInterest: [HackInterest.OTHER],
    hackOutreach: [HackOutreach.OTHER],
} satisfies RegistrationFormat;

const updateRequest = [
    {
        userId: TESTER.id,
        status: DecisionStatus.WAITLISTED,
        response: DecisionResponse.PENDING,
        emailSent: false,
    },
    {
        userId: OTHER_DECISION.userId,
        status: DecisionStatus.ACCEPTED,
        response: DecisionResponse.PENDING,
        emailSent: false,
    },
] satisfies AdmissionDecision[];

beforeEach(async () => {
    await Models.AdmissionDecision.create(TESTER_DECISION);
    await Models.AdmissionDecision.create(OTHER_DECISION);
    await Models.RegistrationApplication.create(TESTER_APPLICATION);
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

describe("PUT /admission/update/", () => {
    let sendMail: jest.SpiedFunction<typeof MailLib.sendMail> = undefined!;

    beforeEach(async () => {
        // Mock successful send by default
        sendMail = mockSendMail();
        sendMail.mockImplementation(async (_) => ({}) as AxiosResponse);
    });

    it("gives forbidden error for user without elevated perms", async () => {
        const responseUser = await putAsUser("/admission/update/").send(updateRequest).expect(StatusCode.ClientErrorForbidden);
        expect(JSON.parse(responseUser.text)).toHaveProperty("error", "Forbidden");
    });

    it("should update application status of applicants", async () => {
        const response = await putAsStaff("/admission/update/").send(updateRequest).expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toHaveProperty("message", "StatusSuccess");

        const ops = updateRequest.map((entry) => Models.AdmissionDecision.findOne({ userId: entry.userId }));
        const retrievedEntries = await Promise.all(ops);

        expect(sendMail).toBeCalledWith({
            templateId: RegistrationTemplates.STATUS_UPDATE,
            recipients: [], // empty because neither test case starts as status = TBD
        } satisfies MailInfo);

        expect(retrievedEntries).toMatchObject(
            expect.arrayContaining(
                updateRequest.map((item) => expect.objectContaining({ status: item.status, userId: item.userId })),
            ),
        );
    });
});

describe("GET /admission/rsvp/", () => {
    it("gives a UserNotFound error for an non-existent user", async () => {
        await Models.AdmissionDecision.deleteOne({
            userId: TESTER.id,
        });

        const response = await getAsAttendee("/admission/rsvp/").expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "UserNotFound");
    });

    it("works for an attendee user and returns filtered data", async () => {
        const response = await getAsAttendee("/admission/rsvp/").expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({
            userId: TESTER_DECISION.userId,
            status: TESTER_DECISION.status,
            response: TESTER_DECISION.response,
        });
    });

    it("works for a staff user and returns unfiltered data", async () => {
        const response = await getAsStaff("/admission/rsvp/").expect(StatusCode.SuccessOK);

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

describe("GET /admission/rsvp/:USERID", () => {
    it("returns forbidden error if caller doesn't have elevated perms", async () => {
        const response = await getAsAttendee(`/admission/rsvp/${TESTER.id}`).expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("gets if caller has elevated perms", async () => {
        const response = await getAsStaff(`/admission/rsvp/${TESTER.id}`).expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject(TESTER_DECISION);
    });

    it("returns UserNotFound error if user doesn't exist", async () => {
        const response = await getAsStaff("/admission/rsvp/idontexist").expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "UserNotFound");
    });
});

describe("PUT /admission/rsvp/accept", () => {
    let sendMail: jest.SpiedFunction<typeof MailLib.sendMail> = undefined!;

    beforeEach(async () => {
        // Mock successful send by default
        sendMail = mockSendMail();
        sendMail.mockImplementation(async (_) => ({}) as AxiosResponse);
    });

    it("returns UserNotFound for nonexistent user", async () => {
        await Models.AdmissionDecision.deleteOne({
            userId: TESTER.id,
        });

        const response = await putAsApplicant("/admission/rsvp/accept/").expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "UserNotFound");
    });

    it("lets applicant accept accepted decision", async () => {
        await putAsApplicant("/admission/rsvp/accept/").expect(StatusCode.SuccessOK);
        const stored = await Models.AdmissionDecision.findOne({ userId: TESTER.id });

        expect(sendMail).toBeCalledWith({
            templateId: RegistrationTemplates.RSVP_CONFIRMATION,
            recipients: [TESTER_APPLICATION.emailAddress],
            subs: { name: TESTER_APPLICATION.preferredName },
        } satisfies MailInfo);

        expect(stored).toMatchObject({
            ...TESTER_DECISION,
            response: DecisionResponse.ACCEPTED,
        } satisfies AdmissionDecision);
    });

    it("doesn't let applicant accept rejected decision", async () => {
        await Models.AdmissionDecision.findOneAndUpdate({ userId: TESTER.id }, { status: DecisionStatus.REJECTED });

        const response = await putAsApplicant("/admission/rsvp/accept/").expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NotAccepted");
    });
    it("does not let applicant re-rsvp twice", async () => {
        await Models.AdmissionDecision.findOneAndUpdate(
            { userId: TESTER.id },
            { status: DecisionStatus.ACCEPTED, response: DecisionResponse.DECLINED },
        );

        const response = await putAsApplicant("/admission/rsvp/accept/").expect(StatusCode.ClientErrorConflict);
        expect(JSON.parse(response.text)).toHaveProperty("error", "AlreadyRSVPed");
    });
});

describe("PUT /admission/rsvp/decline/", () => {
    let sendMail: jest.SpiedFunction<typeof MailLib.sendMail> = undefined!;

    beforeEach(async () => {
        // Mock successful send by default
        sendMail = mockSendMail();
        sendMail.mockImplementation(async (_) => ({}) as AxiosResponse);
    });

    it("returns UserNotFound for nonexistent user", async () => {
        await Models.AdmissionDecision.deleteOne({
            userId: TESTER.id,
        });

        const response = await putAsApplicant("/admission/rsvp/decline/").expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "UserNotFound");
    });

    it("lets applicant decline accepted decision", async () => {
        await putAsApplicant("/admission/rsvp/decline/").expect(StatusCode.SuccessOK);
        const stored = await Models.AdmissionDecision.findOne({ userId: TESTER.id });

        expect(sendMail).toBeCalledWith({
            templateId: RegistrationTemplates.RSVP_DECLINED,
            recipients: [TESTER_APPLICATION.emailAddress],
        } satisfies MailInfo);

        expect(stored).toMatchObject({
            ...TESTER_DECISION,
            response: DecisionResponse.DECLINED,
        } satisfies AdmissionDecision);
    });

    it("doesn't let applicant accept rejected decision", async () => {
        await Models.AdmissionDecision.findOneAndUpdate({ userId: TESTER.id }, { status: DecisionStatus.REJECTED });

        const response = await putAsApplicant("/admission/rsvp/decline/").expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NotAccepted");
    });

    it("does not let applicant re-rsvp twice", async () => {
        await Models.AdmissionDecision.findOneAndUpdate(
            { userId: TESTER.id },
            { status: DecisionStatus.ACCEPTED, response: DecisionResponse.DECLINED },
        );

        const response = await putAsApplicant("/admission/rsvp/decline/").expect(StatusCode.ClientErrorConflict);
        expect(JSON.parse(response.text)).toHaveProperty("error", "AlreadyRSVPed");
    });
});
