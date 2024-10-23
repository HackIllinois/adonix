import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { StatusCode } from "status-code-enum";
import Models from "../../common/models";
import { RegistrationTemplates } from "../../common/config";
import { TESTER, getAsUser, getAsAdmin, postAsUser } from "../../common/testTools";
import {
    Degree,
    Gender,
    HackInterest,
    HackOutreach,
    Race,
    RegistrationApplication,
    RegistrationApplicationRequest,
} from "./registration-schemas";
import type * as MailLib from "../../services/mail/mail-lib";
import type { AxiosResponse } from "axios";
import { MailInfo } from "../mail/mail-schemas";

const APPLICATION = {
    isProApplicant: false,
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
    hackInterest: [HackInterest.TECHNICAL_WORKSHOPS],
    hackOutreach: [HackOutreach.INSTAGRAM],
} satisfies RegistrationApplicationRequest;

const UNSUBMITTED_REGISTRATION = { userId: TESTER.id, hasSubmitted: false, ...APPLICATION } satisfies RegistrationApplication;
const UNSUBMITTED_OTHER_REGISTRATION = {
    ...UNSUBMITTED_REGISTRATION,
    userId: "otherUser",
} satisfies RegistrationApplication;
const SUBMITTED_REGISTRATION = { userId: TESTER.id, hasSubmitted: true, ...APPLICATION } satisfies RegistrationApplication;

describe("GET /registration/", () => {
    beforeEach(async () => {
        await Models.RegistrationApplication.create(UNSUBMITTED_REGISTRATION);
    });

    it("should retrieve registration", async () => {
        const response = await getAsUser("/registration/").expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject(UNSUBMITTED_REGISTRATION);
    });

    it("should provide a not found error when registration does not exist", async () => {
        await Models.RegistrationApplication.deleteOne(UNSUBMITTED_REGISTRATION);

        const response = await getAsUser("/registration/").expect(StatusCode.ClientErrorNotFound);
        expect(JSON.parse(response.text)).toHaveProperty("error", "NotFound");
    });
});

describe("GET /registration/userid/:USERID", () => {
    const OTHER_USER_ID = UNSUBMITTED_OTHER_REGISTRATION.userId;
    beforeEach(async () => {
        await Models.RegistrationApplication.create(UNSUBMITTED_OTHER_REGISTRATION);
    });

    it("should retrieve registration", async () => {
        const response = await getAsAdmin(`/registration/userid/${OTHER_USER_ID}`).expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject(UNSUBMITTED_OTHER_REGISTRATION);
    });

    it("should provide a forbidden error to non-staff user", async () => {
        const response = await getAsUser(`/registration/userid/${OTHER_USER_ID}`).expect(StatusCode.ClientErrorForbidden);
        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("should provide a not found error when registration does not exist", async () => {
        await Models.RegistrationApplication.deleteOne(UNSUBMITTED_OTHER_REGISTRATION);

        const response = await getAsAdmin(`/registration/userid/${OTHER_USER_ID}`).expect(StatusCode.ClientErrorNotFound);
        expect(JSON.parse(response.text)).toHaveProperty("error", "NotFound");
    });
});

describe("POST /registration/", () => {
    it("should create registration", async () => {
        const response = await postAsUser("/registration/").send(APPLICATION).expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject(APPLICATION);

        // Stored in DB
        const stored: RegistrationApplication | null = await Models.RegistrationApplication.findOne({
            userId: UNSUBMITTED_REGISTRATION.userId,
        });
        expect(stored).toMatchObject(UNSUBMITTED_REGISTRATION);
    });

    it("should update registration", async () => {
        await Models.RegistrationApplication.create({
            ...UNSUBMITTED_REGISTRATION,
            degree: "PhD of Data Corruption",
        });
        const response = await postAsUser("/registration/").send(APPLICATION).expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject(APPLICATION);

        // Stored in DB
        const stored: RegistrationApplication | null = await Models.RegistrationApplication.findOne({
            userId: UNSUBMITTED_REGISTRATION.userId,
        });
        expect(stored).toMatchObject(UNSUBMITTED_REGISTRATION);
    });

    it("should provide bad request error when registration is invalid", async () => {
        const response = await postAsUser("/registration/").send({}).expect(StatusCode.ClientErrorBadRequest);
        expect(JSON.parse(response.text)).toHaveProperty("error", "BadRequest");
    });

    it("should provide already submitted error when user has already submitted registration", async () => {
        await Models.RegistrationApplication.create(SUBMITTED_REGISTRATION);

        const response = await postAsUser("/registration/").send(APPLICATION).expect(StatusCode.ClientErrorBadRequest);
        expect(JSON.parse(response.text)).toHaveProperty("error", "AlreadySubmitted");
    });
});

function mockSendMail(): jest.SpiedFunction<typeof MailLib.sendMail> {
    const mailLib = require("../../services/mail/mail-lib") as typeof MailLib;
    return jest.spyOn(mailLib, "sendMail");
}

describe("POST /registration/submit/", () => {
    let sendMail: jest.SpiedFunction<typeof MailLib.sendMail> = undefined!;

    beforeEach(async () => {
        await Models.RegistrationApplication.create(UNSUBMITTED_REGISTRATION);

        // Mock successful send by default
        sendMail = mockSendMail();
        sendMail.mockImplementation(async (_) => ({}) as AxiosResponse);
    });

    it("should submit registration", async () => {
        const response = await postAsUser("/registration/submit/").send().expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject(SUBMITTED_REGISTRATION);
        expect(sendMail).toBeCalledWith({
            templateId: RegistrationTemplates.REGISTRATION_SUBMISSION,
            recipients: [UNSUBMITTED_REGISTRATION.emailAddress],
            subs: { name: UNSUBMITTED_REGISTRATION.preferredName },
        } satisfies MailInfo);

        // Stored in DB
        const stored: RegistrationApplication | null = await Models.RegistrationApplication.findOne({
            userId: UNSUBMITTED_REGISTRATION.userId,
        });
        expect(stored).toMatchObject(SUBMITTED_REGISTRATION);
    });

    it("should provide not found error when registration does not exist", async () => {
        await Models.RegistrationApplication.deleteOne(UNSUBMITTED_REGISTRATION);

        const response = await postAsUser("/registration/submit/").send().expect(StatusCode.ClientErrorNotFound);
        expect(JSON.parse(response.text)).toHaveProperty("error", "NotFound");
    });

    it("should provide already submitted error when already submitted", async () => {
        await Models.RegistrationApplication.updateOne(UNSUBMITTED_REGISTRATION, SUBMITTED_REGISTRATION);

        const response = await postAsUser("/registration/submit/").send().expect(StatusCode.ClientErrorBadRequest);
        expect(JSON.parse(response.text)).toHaveProperty("error", "AlreadySubmitted");
    });

    it("should provide error when email fails to send and still submit registration", async () => {
        // Mock failure
        sendMail.mockImplementation(async (_) => {
            throw new Error("EmailFailedToSend");
        });

        const response = await postAsUser("/registration/submit/").send().expect(StatusCode.ServerErrorInternal);
        expect(JSON.parse(response.text)).toHaveProperty("error", "InternalError");

        // Still stored in DB
        const stored: RegistrationApplication | null = await Models.RegistrationApplication.findOne({
            userId: UNSUBMITTED_REGISTRATION.userId,
        });
        expect(stored).toMatchObject(SUBMITTED_REGISTRATION);
    });
});
