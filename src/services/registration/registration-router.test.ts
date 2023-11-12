import { beforeEach, describe, expect, it } from "@jest/globals";
import Models from "../../database/models.js";
import { RegistrationInfo, RegistrationApplication } from "../../database/registration-db.js";
import { getAsStaff, getAsUser, postAsUser, putAsUser, TESTER } from "../../testTools.js";
import { StatusCode } from "status-code-enum";
import { UpdateRegistrationRecord } from "./registration-formats.js";

const TESTER_INFO = {
    userId: TESTER.id,
    preferredName: TESTER.name,
    userName: TESTER.userName,
} satisfies RegistrationInfo;

const TESTER_APPLICATION = {
    userId: TESTER.id,
    resume: "bob-resume.pdf",
    essays: ["essay 1", "essay 2"],
} satisfies RegistrationApplication;

const updateRequest = {
    userId: TESTER.id,
    preferredName: TESTER.name,
    userName: TESTER.userName,
    resume: "bob-resume.pdf",
    essays: ["essay 1", "essay 2"],
} satisfies UpdateRegistrationRecord;

beforeEach(async () => {
    Models.initialize();
    await Models.RegistrationApplication.create(TESTER_APPLICATION);
    await Models.RegistrationInfo.create(TESTER_INFO);
});

describe("GET /registration/", () => {
    it("gets registration info for current user", async () => {
        const response = await getAsUser("/registration/").expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({
            userId: TESTER.id,
            preferredName: TESTER.name,
            userName: TESTER.userName,
            resume: "bob-resume.pdf",
            essays: ["essay 1", "essay 2"],
        });
    });

    it("returns UserNotFound if registration info doesn't exist", async () => {
        await Models.RegistrationInfo.deleteOne({
            userId: TESTER.id,
        });
        await Models.RegistrationApplication.deleteOne({
            userId: TESTER.id,
        });

        const response = await getAsUser("/registration/").expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "UserNotFound");
    });
});

describe("GET /registration/:USERID", () => {
    it("returns forbidden error if caller doesn't have elevated perms", async () => {
        const response = await getAsUser(`/registration/${TESTER.id}`).expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("gets if caller has elevated perms", async () => {
        const response = await getAsStaff(`/registration/${TESTER.id}`).expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({
            userId: TESTER.id,
            preferredName: TESTER.name,
            userName: TESTER.userName,
            resume: "bob-resume.pdf",
            essays: ["essay 1", "essay 2"],
        });
    });

    it("returns UserNotFound error if user doesn't exist", async () => {
        const response = await getAsStaff("/registration/idontexist").expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "UserNotFound");
    });
});

describe("POST /registration/", () => {
    it("returns UserAlreadyExists for user already in registration database", async () => {
        const response = await postAsUser("/registration/").send(updateRequest).expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "UserAlreadyExists");
    });

    it("works for user NOT already in registration database", async () => {
        await Models.RegistrationInfo.deleteOne({
            userId: TESTER.id,
        });
        await Models.RegistrationApplication.deleteOne({
            userId: TESTER.id,
        });

        const response = await postAsUser("/registration/").send(updateRequest).expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({
            newRegistrationInfo: {
                userId: TESTER.id,
                preferredName: TESTER.name,
                userName: TESTER.userName,
            },
            newRegistrationApplication: {
                userId: TESTER.id,
                resume: "bob-resume.pdf",
                essays: ["essay 1", "essay 2"],
            },
        });
    });
});

describe("PUT /registration/", () => {
    it("gives a UserNotFound error for an non-existent user", async () => {
        await Models.RegistrationInfo.deleteOne({
            userId: TESTER.id,
        });
        await Models.RegistrationApplication.deleteOne({
            userId: TESTER.id,
        });

        const response = await putAsUser("/registration/").send(updateRequest).expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "UserNotFound");
    });

    it("works for user already in registration database", async () => {
        const response = await putAsUser("/registration/").send(updateRequest).expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({
            updatedRegistrationInfo: {
                userId: TESTER.id,
                preferredName: TESTER.name,
                userName: TESTER.userName,
            },
            updatedRegistrationApplication: {
                userId: TESTER.id,
                resume: "bob-resume.pdf",
                essays: ["essay 1", "essay 2"],
            },
        });
    });
});
