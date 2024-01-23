import { beforeEach, describe, expect, it } from "@jest/globals";
import { StatusCode } from "status-code-enum";
import Models from "../../database/models.js";
import { TESTER, getAsUser, getAsAdmin, postAsUser } from "../../testTools.js";
import { RegistrationFormat } from "./registration-formats.js";
import { Degree, Gender, HackInterest, HackOutreach, Race } from "./registration-models.js";

const GENERAL_APPLICATION = {
    isProApplicant: false,
    userId: TESTER.id,
    preferredName: "ap",
    legalName: "ap4",
    emailAddress: "apirani2@illinois.edu",
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

const UNSUBMITTED_GENERAL_REGISTRATION_DATA = { hasSubmitted: false, ...GENERAL_APPLICATION };
const SUBMITTED_GENERAL_REGISTRATION_DATA = { hasSubmitted: true, ...GENERAL_APPLICATION };

describe("GET /registration/ Endpoint", () => {
    beforeEach(async () => {
        await Models.RegistrationApplication.create(UNSUBMITTED_GENERAL_REGISTRATION_DATA);
    });

    it("should retrieve user's registration data when it exists", async () => {
        const response = await getAsUser("/registration/").expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject(UNSUBMITTED_GENERAL_REGISTRATION_DATA);
    });

    it("should return 404 error when user's registration data does not exist", async () => {
        await Models.RegistrationApplication.deleteOne({ userId: TESTER.id });
        const response = await getAsUser("/registration/").expect(StatusCode.ClientErrorNotFound);
        expect(JSON.parse(response.text)).toHaveProperty("error", "NotFound");
    });
});

describe("GET /registration/userid/:USERID Endpoint", () => {
    beforeEach(async () => {
        await Models.RegistrationApplication.create(UNSUBMITTED_GENERAL_REGISTRATION_DATA);
    });

    it("should retrieve user's registration data with elevated permissions", async () => {
        const response = await getAsAdmin(`/registration/userid/${TESTER.id}`).expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject(UNSUBMITTED_GENERAL_REGISTRATION_DATA);
    });

    it("should return 403 error when user does not have elevated permissions", async () => {
        const response = await getAsUser(`/registration/userid/${TESTER.id}`).expect(StatusCode.ClientErrorForbidden);
        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("should return 404 error when specified user ID does not have registration data", async () => {
        const response = await getAsAdmin("/registration/userid/nonexistentuser").expect(StatusCode.ClientErrorNotFound);
        expect(JSON.parse(response.text)).toHaveProperty("error", "UserNotFound");
    });
});

describe("POST /registration/ Endpoint", () => {
    it("should create or update user's registration data with valid data", async () => {
        const response = await postAsUser("/registration/").send(GENERAL_APPLICATION).expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject(UNSUBMITTED_GENERAL_REGISTRATION_DATA);
    });

    it("should return 400 error when registration data is invalid", async () => {
        const response = await postAsUser("/registration/").send({}).expect(StatusCode.ClientErrorBadRequest);
        expect(JSON.parse(response.text)).toHaveProperty("error", "BadRequest");
    });

    it("should return 422 error when user has already submitted registration data", async () => {
        await Models.RegistrationApplication.create(SUBMITTED_GENERAL_REGISTRATION_DATA);

        const response = await postAsUser("/registration/")
            .send(GENERAL_APPLICATION)
            .expect(StatusCode.ClientErrorUnprocessableEntity);
        expect(JSON.parse(response.text)).toHaveProperty("error", "AlreadySubmitted");
    });
});
