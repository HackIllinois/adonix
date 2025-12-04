import { beforeEach, describe, expect, it, jest, afterEach } from "@jest/globals";
import { StatusCode } from "status-code-enum";
import Models from "../../common/models";
import { Templates } from "../../common/config";
import { TESTER, getAsUser, getAsAdmin, postAsUser, putAsUser } from "../../common/testTools";
import {
    RegistrationApplicationDraft,
    RegistrationApplicationDraftRequest,
    RegistrationApplicationSubmitted,
    RegistrationChallenge,
} from "./registration-schemas";
import type * as MailLib from "../../services/mail/mail-lib";
import type * as ChallengeLib from "./challenge-lib";
import { MailInfo } from "../mail/mail-schemas";
import { Request, Response, NextFunction } from "express";

jest.mock("../../middleware/upload", () => ({
    single: (): (req: Request, _res: Response, next: NextFunction) => void => {
        return (req: Request, _res: Response, next: NextFunction): void => {
            if ((global as { mockFile?: Express.Multer.File }).mockFile) {
                req.file = (global as { mockFile?: Express.Multer.File }).mockFile;
            }
            next();
        };
    },
}));

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
    application3: "I love hack",
    applicationOptional: "optional essay",
    pro: true,
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

const CHALLENGE = {
    userId: TESTER.id,
    inputFileId: "1U1UL1iNfrygNv5YsXPvlyk9ha4erMzF_",
    attempts: 0,
    complete: false,
} satisfies RegistrationChallenge;

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

function mockFetchImageFromS3(): jest.SpiedFunction<typeof ChallengeLib.fetchImageFromS3> {
    const challengeLib = require("./challenge-lib") as typeof ChallengeLib;
    return jest.spyOn(challengeLib, "fetchImageFromS3");
}

function mockCompareImages(): jest.SpiedFunction<typeof ChallengeLib.compareImages> {
    const challengeLib = require("./challenge-lib") as typeof ChallengeLib;
    return jest.spyOn(challengeLib, "compareImages");
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
        sendMail.mockImplementation(async (_) => ({
            messageId: "test-message-id",
        }));
    });

    it("should submit registration with body data", async () => {
        const response = await postAsUser("/registration/submit/").send(APPLICATION).expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject(SUBMITTED_REGISTRATION);
        expect(sendMail).toBeCalledWith({
            templateId: Templates.REGISTRATION_SUBMISSION,
            recipient: APPLICATION.email,
            templateData: { name: APPLICATION.firstName, pro: APPLICATION.pro },
        } satisfies MailInfo);

        // Should be stored in submissions collection
        const storedSubmission: RegistrationApplicationSubmitted | null = await Models.RegistrationApplicationSubmitted.findOne({
            userId: DRAFT_REGISTRATION.userId,
        });
        expect(storedSubmission).toMatchObject(SUBMITTED_REGISTRATION);

        // Draft should be deleted if it exists
        const storedDraft: RegistrationApplicationDraft | null = await Models.RegistrationApplicationDraft.findOne({
            userId: DRAFT_REGISTRATION.userId,
        });
        expect(storedDraft).toBeNull();
    });

    it("should submit registration even when no draft exists", async () => {
        await Models.RegistrationApplicationDraft.deleteOne(DRAFT_REGISTRATION);

        const response = await postAsUser("/registration/submit/").send(APPLICATION).expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject(SUBMITTED_REGISTRATION);
        expect(sendMail).toBeCalledWith({
            templateId: Templates.REGISTRATION_SUBMISSION,
            recipient: APPLICATION.email,
            templateData: { name: APPLICATION.firstName, pro: APPLICATION.pro },
        } satisfies MailInfo);

        // Should be stored in submissions collection
        const storedSubmission: RegistrationApplicationSubmitted | null = await Models.RegistrationApplicationSubmitted.findOne({
            userId: DRAFT_REGISTRATION.userId,
        });
        expect(storedSubmission).toMatchObject(SUBMITTED_REGISTRATION);
    });

    it("should provide already submitted error when already submitted", async () => {
        await Models.RegistrationApplicationSubmitted.create(SUBMITTED_REGISTRATION);

        const response = await postAsUser("/registration/submit/").send(APPLICATION).expect(StatusCode.ClientErrorBadRequest);
        expect(JSON.parse(response.text)).toHaveProperty("error", "AlreadySubmitted");
    });

    it("should provide bad request error when required fields are missing", async () => {
        const incompleteApplication = {
            firstName: TESTER.name,
            lastName: TESTER.name,
            // Missing required fields
        };

        const response = await postAsUser("/registration/submit/")
            .send(incompleteApplication)
            .expect(StatusCode.ClientErrorBadRequest);
        expect(JSON.parse(response.text)).toHaveProperty("error", "BadRequest");
    });

    it("should provide bad request error when email is invalid", async () => {
        const response = await postAsUser("/registration/submit/")
            .send(APPLICATION_INVALID_EMAIL)
            .expect(StatusCode.ClientErrorBadRequest);
        expect(JSON.parse(response.text)).toHaveProperty("error", "BadRequest");
    });

    it("should provide error when email fails to send and still submit registration", async () => {
        // Mock failure
        sendMail.mockImplementation(async (_) => {
            throw new Error("EmailFailedToSend");
        });

        const response = await postAsUser("/registration/submit/").send(APPLICATION).expect(StatusCode.ServerErrorInternal);
        expect(JSON.parse(response.text)).toHaveProperty("error", "InternalError");

        // Should be stored in submissions collection
        const storedSubmission: RegistrationApplicationSubmitted | null = await Models.RegistrationApplicationSubmitted.findOne({
            userId: DRAFT_REGISTRATION.userId,
        });
        expect(storedSubmission).toMatchObject(SUBMITTED_REGISTRATION);

        // Draft should be deleted if it exists
        const storedDraft: RegistrationApplicationDraft | null = await Models.RegistrationApplicationDraft.findOne({
            userId: DRAFT_REGISTRATION.userId,
        });
        expect(storedDraft).toBeNull();
    });
});

describe("POST /registration/challenge/", () => {
    let fetchImageFromS3: jest.SpiedFunction<typeof ChallengeLib.fetchImageFromS3> = undefined!;
    let compareImages: jest.SpiedFunction<typeof ChallengeLib.compareImages> = undefined!;

    beforeEach(async (): Promise<void> => {
        await Models.RegistrationApplicationSubmitted.create(SUBMITTED_REGISTRATION);
        await Models.RegistrationChallenge.create(CHALLENGE);

        // Mock S3 fetch and image comparison
        fetchImageFromS3 = mockFetchImageFromS3();
        fetchImageFromS3.mockResolvedValue(Buffer.from("mock-reference-image"));

        compareImages = mockCompareImages();
        compareImages.mockResolvedValue(true); // Default to correct solution
    });

    afterEach((): void => {
        // Clean up mock file
        delete (global as { mockFile?: Express.Multer.File }).mockFile;
    });

    it("should accept correct solution and mark challenge as complete", async () => {
        const mockImageBuffer = Buffer.from("mock-uploaded-image");
        (global as any).mockFile = {
            buffer: mockImageBuffer,
            originalname: "solution.png",
            mimetype: "image/png",
        } as Express.Multer.File;
        
        const response = await postAsUser("/registration/challenge/")
            .expect(StatusCode.SuccessOK);

        const responseData = JSON.parse(response.text);
        expect(responseData).toMatchObject({
            inputFileId: CHALLENGE.inputFileId,
            attempts: 1,
            complete: true,
        });

        expect(fetchImageFromS3).toHaveBeenCalledWith(CHALLENGE.inputFileId);
        expect(compareImages).toHaveBeenCalled();

        // Verify in database
        const storedChallenge: RegistrationChallenge | null = await Models.RegistrationChallenge.findOne({
            userId: TESTER.id,
        });
        expect(storedChallenge?.complete).toBe(true);
        expect(storedChallenge?.attempts).toBe(1);
    });

    it("should reject incorrect solution and increment attempts", async () => {
        compareImages.mockResolvedValue(false); // Incorrect solution

        const mockImageBuffer = Buffer.from("mock-uploaded-image");
        (global as any).mockFile = {
            buffer: mockImageBuffer,
            originalname: "solution.png",
            mimetype: "image/png",
        } as Express.Multer.File;
        
        const response = await postAsUser("/registration/challenge/")
            .expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "IncorrectSolution");

        // Verify attempts incremented but not complete
        const storedChallenge: RegistrationChallenge | null = await Models.RegistrationChallenge.findOne({
            userId: TESTER.id,
        });
        expect(storedChallenge?.complete).toBe(false);
        expect(storedChallenge?.attempts).toBe(1);
    });

    it("should provide bad request error when no file is uploaded", async () => {
        // Don't set mockFile
        const response = await postAsUser("/registration/challenge/")
            .expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NoFileUploaded");
    });

    it("should provide already solved error when challenge is already complete", async () => {
        await Models.RegistrationChallenge.updateOne(
            { userId: TESTER.id },
            { complete: true }
        );

        const mockImageBuffer = Buffer.from("mock-uploaded-image");
        (global as any).mockFile = {
            buffer: mockImageBuffer,
            originalname: "solution.png",
            mimetype: "image/png",
        } as Express.Multer.File;
        
        const response = await postAsUser("/registration/challenge/")
            .expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "AlreadySolved");
    });

    it("should provide bad request error when no challenge exists", async () => {
        await Models.RegistrationChallenge.deleteOne({ userId: TESTER.id });

        const mockImageBuffer = Buffer.from("mock-uploaded-image");
        (global as any).mockFile = {
            buffer: mockImageBuffer,
            originalname: "solution.png",
            mimetype: "image/png",
        } as Express.Multer.File;
        
        const response = await postAsUser("/registration/challenge/")
            .expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NoChallengeFound");
    });
});