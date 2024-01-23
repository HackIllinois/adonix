import { beforeEach, describe, expect, it } from "@jest/globals";
import { StatusCode } from "status-code-enum";
import Models from "../../database/models.js";
import { RegistrationApplication } from "../../database/registration-db.js";
import { TESTER, getAsUser, getAsAdmin, postAsUser } from "../../testTools.js";
import { RegistrationFormat } from "./registration-formats.js";
import { Degree, Gender, HackInterest, HackOutreach, Race } from "./registration-models.js";

const APPLICATION = {
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

const UNSUBMITTED_REGISTRATION = { hasSubmitted: false, ...APPLICATION } satisfies RegistrationApplication;
const UNSUBMITTED_OTHER_REGISTRATION = {
    ...UNSUBMITTED_REGISTRATION,
    userId: "otherUser",
} satisfies RegistrationApplication;
const SUBMITTED_REGISTRATION = { hasSubmitted: true, ...APPLICATION } satisfies RegistrationApplication;

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
        expect(JSON.parse(response.text)).toMatchObject(UNSUBMITTED_REGISTRATION);

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
        expect(JSON.parse(response.text)).toMatchObject(UNSUBMITTED_REGISTRATION);

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

        const response = await postAsUser("/registration/").send(APPLICATION).expect(StatusCode.ClientErrorUnprocessableEntity);
        expect(JSON.parse(response.text)).toHaveProperty("error", "AlreadySubmitted");
    });
});
