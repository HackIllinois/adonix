import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { StatusCode } from "status-code-enum";
import Models from "../../common/models";
import { Templates } from "../../common/config";
import { TESTER, getAsUser, getAsAdmin, postAsUser, putAsUser } from "../../common/testTools";
import {
    RegistrationApplicationDraft,
    RegistrationApplicationDraftRequest,
    RegistrationApplicationSubmitted,
} from "./registration-schemas";
import type * as MailLib from "../../services/mail/mail-lib";
import type { AxiosResponse } from "axios";
import { MailInfo } from "../mail/mail-schemas";

const APPLICATION = {
    firstName: TESTER.name,
    lastName: TESTER.name,
    preferredName: "Bob",
    age: "21",
    email: TESTER.email,
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
    applicationOptional: "optional essay",
    applicationPro: "I wanna be a Pro",
    attribution: ["Word of Mouth", "Instagram"],
    eventInterest: ["Meeting New People"],
    requestTravelReimbursement: false,
} satisfies RegistrationApplicationDraftRequest;

const APPLICATION_INVALID_EMAIL = { ...APPLICATION, email: "invalidemail" };

const DRAFT_REGISTRATION = { userId: TESTER.id, ...APPLICATION } satisfies RegistrationApplicationDraft;
const DRAFT_OTHER_REGISTRATION = {
    ...DRAFT_REGISTRATION,
    userId: "otherUser",
} satisfies RegistrationApplicationDraft;
const SUBMITTED_REGISTRATION = { userId: TESTER.id, ...APPLICATION } satisfies RegistrationApplicationSubmitted;

describe("GET /registration/", () => {
    beforeEach(async () => {
        await Models.RegistrationApplicationSubmitted.create(SUBMITTED_REGISTRATION);
    });

    it("should retrieve submitted registration", async () => {
        const response = await getAsUser("/registration/").expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject(SUBMITTED_REGISTRATION);
    });

    it("should provide a not found error when submitted registration does not exist", async () => {
        await Models.RegistrationApplicationSubmitted.deleteOne(SUBMITTED_REGISTRATION);

        const response = await getAsUser("/registration/").expect(StatusCode.ClientErrorNotFound);
        expect(JSON.parse(response.text)).toHaveProperty("error", "NotFound");
    });

    it("should not retrieve draft registration even when draft exists", async () => {
        await Models.RegistrationApplicationDraft.create(DRAFT_REGISTRATION);

        const response = await getAsUser("/registration/").expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject(SUBMITTED_REGISTRATION);
    });
});

describe("GET /registration/userid/:USERID", () => {
    const OTHER_USER_ID = DRAFT_OTHER_REGISTRATION.userId;
    beforeEach(async () => {
        await Models.RegistrationApplicationDraft.create(DRAFT_OTHER_REGISTRATION);
    });

    it("should retrieve registration", async () => {
        const response = await getAsAdmin(`/registration/userid/${OTHER_USER_ID}`).expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject(DRAFT_OTHER_REGISTRATION);
    });

    it("should provide a forbidden error to non-staff user", async () => {
        const response = await getAsUser(`/registration/userid/${OTHER_USER_ID}`).expect(StatusCode.ClientErrorForbidden);
        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("should provide a not found error when registration does not exist", async () => {
        await Models.RegistrationApplicationDraft.deleteOne(DRAFT_OTHER_REGISTRATION);

        const response = await getAsAdmin(`/registration/userid/${OTHER_USER_ID}`).expect(StatusCode.ClientErrorNotFound);
        expect(JSON.parse(response.text)).toHaveProperty("error", "NotFound");
    });
});

function mockSendMail(): jest.SpiedFunction<typeof MailLib.sendMail> {
    const mailLib = require("../../services/mail/mail-lib") as typeof MailLib;
    return jest.spyOn(mailLib, "sendMail");
}

describe("GET /registration/draft/", () => {
    beforeEach(async () => {
        await Models.RegistrationApplicationDraft.create(DRAFT_REGISTRATION);
    });

    it("should retrieve draft registration", async () => {
        const response = await getAsUser("/registration/draft/").expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject(DRAFT_REGISTRATION);
    });

    it("should provide a not found error when draft does not exist", async () => {
        await Models.RegistrationApplicationDraft.deleteOne(DRAFT_REGISTRATION);

        const response = await getAsUser("/registration/draft/").expect(StatusCode.ClientErrorNotFound);
        expect(JSON.parse(response.text)).toHaveProperty("error", "NotFound");
    });
});

describe("PUT /registration/draft/", () => {
    it("should create new draft registration when none exists", async () => {
        const response = await putAsUser("/registration/draft/").send(APPLICATION).expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject(APPLICATION);

        const stored: RegistrationApplicationDraft | null = await Models.RegistrationApplicationDraft.findOne({
            userId: DRAFT_REGISTRATION.userId,
        });
        expect(stored).toMatchObject(DRAFT_REGISTRATION);
    });

    it("should update existing draft", async () => {
        await Models.RegistrationApplicationDraft.create(DRAFT_REGISTRATION);

        const updatedApplication = {
            ...APPLICATION,
            firstName: "James Updated",
            email: "updated@example.com",
        };

        const response = await putAsUser("/registration/draft/").send(updatedApplication).expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject(updatedApplication);

        const stored: RegistrationApplicationDraft | null = await Models.RegistrationApplicationDraft.findOne({
            userId: DRAFT_REGISTRATION.userId,
        });
        expect(stored).toMatchObject({ ...DRAFT_REGISTRATION, ...updatedApplication });
    });

    it("should provide bad request error when invalid fields are included", async () => {
        const response = await putAsUser("/registration/draft/").send({ age: 18 }).expect(StatusCode.ClientErrorBadRequest);
        expect(JSON.parse(response.text)).toHaveProperty("error", "BadRequest");
    });

    it("should provide bad request error when email is invalid", async () => {
        const response = await putAsUser("/registration/draft/")
            .send(APPLICATION_INVALID_EMAIL)
            .expect(StatusCode.ClientErrorBadRequest);
        expect(JSON.parse(response.text)).toHaveProperty("error", "BadRequest");
    });

    it("should provide already submitted error when user has already submitted registration", async () => {
        await Models.RegistrationApplicationSubmitted.create(SUBMITTED_REGISTRATION);

        const response = await putAsUser("/registration/draft/").send(APPLICATION).expect(StatusCode.ClientErrorBadRequest);
        expect(JSON.parse(response.text)).toHaveProperty("error", "AlreadySubmitted");
    });
});

describe("POST /registration/submit/", () => {
    let sendMail: jest.SpiedFunction<typeof MailLib.sendMail> = undefined!;

    beforeEach(async () => {
        await Models.RegistrationApplicationDraft.create(DRAFT_REGISTRATION);

        // Mock successful send by default
        sendMail = mockSendMail();
        sendMail.mockImplementation(async (_) => ({}) as AxiosResponse);
    });

    it("should submit registration", async () => {
        const response = await postAsUser("/registration/submit/").send().expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject(SUBMITTED_REGISTRATION);
        expect(sendMail).toBeCalledWith({
            templateId: Templates.REGISTRATION_SUBMISSION,
            recipients: [DRAFT_REGISTRATION.email],
            subs: { name: DRAFT_REGISTRATION.firstName },
        } satisfies MailInfo);

        // Should be stored in submissions collection
        const storedSubmission: RegistrationApplicationSubmitted | null = await Models.RegistrationApplicationSubmitted.findOne({
            userId: DRAFT_REGISTRATION.userId,
        });
        expect(storedSubmission).toMatchObject(SUBMITTED_REGISTRATION);

        // Draft should be deleted
        const storedDraft: RegistrationApplicationDraft | null = await Models.RegistrationApplicationDraft.findOne({
            userId: DRAFT_REGISTRATION.userId,
        });
        expect(storedDraft).toBeNull();
    });

    it("should provide not found error when draft does not exist", async () => {
        await Models.RegistrationApplicationDraft.deleteOne(DRAFT_REGISTRATION);

        const response = await postAsUser("/registration/submit/").send().expect(StatusCode.ClientErrorNotFound);
        expect(JSON.parse(response.text)).toHaveProperty("error", "NotFound");
    });

    it("should provide already submitted error when already submitted", async () => {
        await Models.RegistrationApplicationSubmitted.create(SUBMITTED_REGISTRATION);

        const response = await postAsUser("/registration/submit/").send().expect(StatusCode.ClientErrorBadRequest);
        expect(JSON.parse(response.text)).toHaveProperty("error", "AlreadySubmitted");
    });

    it("should provide incomplete application error when draft is incomplete", async () => {
        const incompleteDraft = {
            ...DRAFT_REGISTRATION,
            application1: undefined,
            application2: undefined,
        };
        await Models.RegistrationApplicationDraft.deleteOne(DRAFT_REGISTRATION);
        await Models.RegistrationApplicationDraft.create(incompleteDraft);

        const response = await postAsUser("/registration/submit/").send().expect(StatusCode.ClientErrorBadRequest);
        expect(JSON.parse(response.text)).toHaveProperty("error", "IncompleteApplication");
    });
    it("should provide error when email fails to send and still submit registration", async () => {
        // Mock failure
        sendMail.mockImplementation(async (_) => {
            throw new Error("EmailFailedToSend");
        });

        const response = await postAsUser("/registration/submit/").send().expect(StatusCode.ServerErrorInternal);
        expect(JSON.parse(response.text)).toHaveProperty("error", "InternalError");

        // Should be stored in submissions collection
        const storedSubmission: RegistrationApplicationSubmitted | null = await Models.RegistrationApplicationSubmitted.findOne({
            userId: DRAFT_REGISTRATION.userId,
        });
        expect(storedSubmission).toMatchObject(SUBMITTED_REGISTRATION);

        // Draft should be deleted
        const storedDraft: RegistrationApplicationDraft | null = await Models.RegistrationApplicationDraft.findOne({
            userId: DRAFT_REGISTRATION.userId,
        });
        expect(storedDraft).toBeNull();
    });
});
