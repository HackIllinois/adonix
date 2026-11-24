import { beforeEach, describe, expect, it, jest, afterEach } from "@jest/globals";
import { readFileSync } from "fs";
import path from "path";
import { StatusCode } from "status-code-enum";
import Models from "../../common/models";
import Config, { Templates } from "../../common/config";
import { TESTER, getAsUser, getAsAdmin, postAsUser, putAsUser } from "../../common/testTools";
import {
    RegistrationApplicationDraft,
    RegistrationApplicationDraftRequest,
    RegistrationApplicationSubmitted,
    RegistrationChallenge,
} from "./registration-schemas";
import type * as MailLib from "../../services/mail/mail-lib";
import type * as ChallengeLib from "./challenge-lib";
import type * as RegistrationLib from "./registration-lib";
import { ALL_TIERS, SALOON_INSTANCES, assignInstance, parseReferenceScores } from "./challenge-lib";
import { parseWorld } from "./saloon/saloon-schemas";
import { Request, Response, NextFunction } from "express";

jest.mock("../../middleware/json-upload", () => ({
    singleJsonFile:
        () =>
        (req: Request, _res: Response, next: NextFunction): void => {
            if ((global as { mockFile?: Express.Multer.File }).mockFile) {
                req.file = (global as { mockFile?: Express.Multer.File }).mockFile;
            }
            next();
        },
}));

const APPLICATION = {
    firstName: TESTER.name,
    lastName: TESTER.name,
    preferredName: "Bob",
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
    interestSoftware: "1",
    interestHardware: "2",
    application1: "I love hack",
    application2: "I love hack",
    application3: "I love hack",
    applicationOptional: "optional essay",
    firstHackathonReason: "I want to build my first team project",
    portfolioLink: "https://example.org/projects",
    eventSuggestions: "An embedded systems workshop",
    pro: true,
    attribution: ["Word of Mouth", "Instagram"],
    eventInterest: ["Meeting New People"],
    vcInvolvement: ["Just curious and want to learn how VC works"],
    hardwareInterest: "Arduino kits and soldering stations",
    requestTravelReimbursement: false,
    mlhNewsletter: true,
} satisfies RegistrationApplicationDraftRequest;

const APPLICATION_INVALID_EMAIL = { ...APPLICATION, email: "invalidemail" };

const DRAFT_REGISTRATION = { userId: TESTER.id, ...APPLICATION } satisfies RegistrationApplicationDraft;
const DRAFT_OTHER_REGISTRATION = {
    ...DRAFT_REGISTRATION,
    userId: "otherUser",
} satisfies RegistrationApplicationDraft;
const SUBMITTED_REGISTRATION = { userId: TESTER.id, ...APPLICATION } satisfies RegistrationApplicationSubmitted;

const FIXTURES = path.join(__dirname, "saloon", "__fixtures__");
const SAMPLE_WORLD_TEXT = readFileSync(path.join(FIXTURES, "tier1-sample.world.json"), "utf8");
const SAMPLE_WORLD = parseWorld(JSON.parse(SAMPLE_WORLD_TEXT));
// Completes all 3 orders on time: score 300
const SAMPLE_PLAN = JSON.parse(readFileSync(path.join(FIXTURES, "tier1-sample.plan.json"), "utf8"));
// Completes only O1 on time: score 100
const ONE_ORDER_PLAN = {
    instance: "tier1-sample",
    routes: {
        "speedster-1": [
            { t: 5, cmd: "go", to: "T1" },
            { t: 5, cmd: "pickup", order: "O1" },
            { t: 10, cmd: "go", to: "F1" },
            { t: 10, cmd: "dropoff", order: "O1" },
        ],
    },
};
const SAMPLE_REFERENCE_SCORE = 300;
const DEFAULT_COOLDOWN_SECONDS = Config.CHALLENGE_SUBMIT_COOLDOWN_SECONDS;
const DEFAULT_TIERS = Config.PRO_CHALLENGE_TIERS;

const CHALLENGE = {
    userId: TESTER.id,
    instanceId: "tier1-sample",
    attempts: 0,
    complete: false,
    bestScore: 0,
} satisfies RegistrationChallenge;

describe("challenge calibration", () => {
    const scores = Object.fromEntries(
        ALL_TIERS.flatMap((tier) => SALOON_INSTANCES[tier]).map(({ id }, index) => [id, SAMPLE_REFERENCE_SCORE + index]),
    );
    it("reads a reference score for every world in every tier", () => {
        expect(parseReferenceScores(JSON.stringify(scores))).toEqual(scores);
    });
    it.each([null, 0, -1, "300"])("rejects invalid or missing calibration (%p)", (bad) => {
        expect(() => parseReferenceScores(JSON.stringify({ ...scores, "tier1-01": bad }))).toThrow(/tier1-01/);
        expect(() => parseReferenceScores("{}")).toThrow(/tier1-01/);
        expect(() => parseReferenceScores(JSON.stringify({ ...scores, "tier3-08": undefined }))).toThrow(/tier3-08/);
    });
});

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

    it("should not include staff reviews", async () => {
        await Models.RegistrationApplicationSubmitted.updateOne(
            { userId: TESTER.id },
            { reviews: [{ reviewerId: "some-staff", score: 1 }], reviewCount: 1 },
        );

        const response = await getAsUser("/registration/").expect(StatusCode.SuccessOK);
        const body = JSON.parse(response.text);
        expect(body).toMatchObject(SUBMITTED_REGISTRATION);
        expect(body).not.toHaveProperty("reviews");
        expect(body).not.toHaveProperty("reviewCount");
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

function mockGetWorldFile(): jest.SpiedFunction<typeof ChallengeLib.getWorldFile> {
    const challengeLib = require("./challenge-lib") as typeof ChallengeLib;
    const spy = jest.spyOn(challengeLib, "getWorldFile");
    spy.mockResolvedValue({ text: SAMPLE_WORLD_TEXT, world: SAMPLE_WORLD });
    return spy;
}

function setUploadedFile(content: unknown, originalname = "plan.json"): void {
    const text = typeof content === "string" ? content : JSON.stringify(content);
    (global as { mockFile?: Express.Multer.File }).mockFile = {
        buffer: Buffer.from(text),
        originalname,
        mimetype: "application/json",
    } as Express.Multer.File;
}

// Makes the sample world a calibrated instance for the duration of a test
function useCalibratedSampleInstance(referenceScore: number | null = SAMPLE_REFERENCE_SCORE): void {
    SALOON_INSTANCES[1].push({ id: "tier1-sample", referenceScore });
}

function removeSampleInstance(): void {
    const index = SALOON_INSTANCES[1].findIndex((instance) => instance.id === "tier1-sample");
    if (index !== -1) {
        SALOON_INSTANCES[1].splice(index, 1);
    }
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

    it("should ignore unknown fields and update operators", async () => {
        await Models.RegistrationApplicationDraft.create(DRAFT_REGISTRATION);

        await putAsUser("/registration/draft/")
            .send({ firstName: "James Updated", $unset: { lastName: 1 }, $set: { email: "injected@example.com" } })
            .expect(StatusCode.SuccessOK);

        const stored: RegistrationApplicationDraft | null = await Models.RegistrationApplicationDraft.findOne({
            userId: DRAFT_REGISTRATION.userId,
        });
        expect(stored).toMatchObject({ ...DRAFT_REGISTRATION, firstName: "James Updated" });
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
        sendMail.mockImplementation(async () => "");
    });

    it("should submit registration with body data", async () => {
        const response = await postAsUser("/registration/submit/").send(APPLICATION).expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject(SUBMITTED_REGISTRATION);
        expect(sendMail).toBeCalledWith(Templates.REGISTRATION_SUBMISSION, APPLICATION.email, {
            name: APPLICATION.firstName,
            pro: APPLICATION.pro,
        });

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

    it("should not let applicants pre-fill staff reviews", async () => {
        await postAsUser("/registration/submit/")
            .send({ ...APPLICATION, reviews: [{ reviewerId: "fake-staff", score: 5 }], reviewCount: 99 })
            .expect(StatusCode.SuccessOK);

        const stored = await Models.RegistrationApplicationSubmitted.findOne({ userId: TESTER.id })
            .select("+reviews +reviewCount")
            .lean();
        expect(stored).toMatchObject({ reviews: [], reviewCount: 0 });
    });

    it("should submit registration even when no draft exists", async () => {
        await Models.RegistrationApplicationDraft.deleteOne(DRAFT_REGISTRATION);

        const response = await postAsUser("/registration/submit/").send(APPLICATION).expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject(SUBMITTED_REGISTRATION);
        expect(sendMail).toBeCalledWith(Templates.REGISTRATION_SUBMISSION, APPLICATION.email, {
            name: APPLICATION.firstName,
            pro: APPLICATION.pro,
        });

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

describe("GET /registration/challenge/", () => {
    beforeEach(async () => {
        await Models.RegistrationApplicationSubmitted.create(SUBMITTED_REGISTRATION);
    });

    afterEach((): void => {
        removeSampleInstance();
    });

    it("creates the challenge with a hashed instance on first call", async () => {
        const response = await getAsUser("/registration/challenge/").expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toEqual({
            // The original (v1) fields, describing Tier 1
            instanceId: assignInstance(TESTER.id),
            attempts: 0,
            complete: false,
            bestScore: 0,
            normalizedScore: 0, // Tier 1 is calibrated, so a fresh 0 normalizes to 0
            passRatio: Config.PRO_CHALLENGE_PASS_RATIO,
            lastReport: null,
            // Added for multiple tiers
            overallScore: 0,
            tiers: [
                {
                    tier: 1,
                    instanceId: assignInstance(TESTER.id),
                    attempts: 0,
                    bestScore: 0,
                    normalizedScore: 0,
                    lastReport: null,
                    nextSubmitAt: null,
                },
            ],
        });
    });

    it("returns the same challenge on later calls", async () => {
        await getAsUser("/registration/challenge/").expect(StatusCode.SuccessOK);
        await getAsUser("/registration/challenge/").expect(StatusCode.SuccessOK);

        expect(await Models.RegistrationChallenge.countDocuments({ userId: TESTER.id })).toBe(1);
    });

    it("returns the stored score and normalized score", async () => {
        useCalibratedSampleInstance();
        await Models.RegistrationChallenge.create({ ...CHALLENGE, attempts: 2, bestScore: 150 });

        const response = await getAsUser("/registration/challenge/").expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject({
            instanceId: "tier1-sample",
            attempts: 2,
            bestScore: 150,
            normalizedScore: 0.5,
        });
    });

    it("provides a not found error without a registration", async () => {
        await Models.RegistrationApplicationSubmitted.deleteOne({ userId: TESTER.id });

        const response = await getAsUser("/registration/challenge/").expect(StatusCode.ClientErrorNotFound);
        expect(JSON.parse(response.text)).toHaveProperty("error", "NotFound");
    });

    it("provides a forbidden error when not applying to pro", async () => {
        await Models.RegistrationApplicationSubmitted.updateOne({ userId: TESTER.id }, { pro: false });

        const response = await getAsUser("/registration/challenge/").expect(StatusCode.ClientErrorForbidden);
        expect(JSON.parse(response.text)).toHaveProperty("error", "MissingPro");
    });
});

describe("GET /registration/challenge/world/", () => {
    let getWorldFile: jest.SpiedFunction<typeof ChallengeLib.getWorldFile> = undefined!;

    beforeEach(async () => {
        await Models.RegistrationApplicationSubmitted.create(SUBMITTED_REGISTRATION);
        getWorldFile = mockGetWorldFile();
    });

    it("downloads the assigned world as world.json", async () => {
        const response = await getAsUser("/registration/challenge/world/").expect(StatusCode.SuccessOK);

        expect(getWorldFile).toHaveBeenCalledWith(assignInstance(TESTER.id));
        expect(response.headers["content-type"]).toMatch(/application\/json/);
        expect(response.headers["content-disposition"]).toMatch(/attachment; filename="world.json"/);
        expect(response.text).toBe(SAMPLE_WORLD_TEXT);
    });

    it("provides a forbidden error when not applying to pro", async () => {
        await Models.RegistrationApplicationSubmitted.updateOne({ userId: TESTER.id }, { pro: false });

        const response = await getAsUser("/registration/challenge/world/").expect(StatusCode.ClientErrorForbidden);
        expect(JSON.parse(response.text)).toHaveProperty("error", "MissingPro");
        expect(getWorldFile).not.toHaveBeenCalled();
    });
});

describe("POST /registration/challenge/", () => {
    let sendMail: jest.SpiedFunction<typeof MailLib.sendMail> = undefined!;

    beforeEach(async (): Promise<void> => {
        await Models.RegistrationApplicationSubmitted.create(SUBMITTED_REGISTRATION);
        await Models.RegistrationChallenge.create(CHALLENGE);
        await Models.AdmissionDecision.create({
            userId: TESTER.id,
            status: "TBD",
            response: "PENDING",
        });

        useCalibratedSampleInstance();
        mockGetWorldFile();

        sendMail = mockSendMail();
        sendMail.mockImplementation(async () => "");

        // These tests upload several times in a row; the cooldown has its own tests below
        Config.CHALLENGE_SUBMIT_COOLDOWN_SECONDS = 0;
    });

    afterEach((): void => {
        delete (global as { mockFile?: Express.Multer.File }).mockFile;
        removeSampleInstance();
        Config.CHALLENGE_SUBMIT_COOLDOWN_SECONDS = DEFAULT_COOLDOWN_SECONDS;
    });

    async function getStoredChallenge(): Promise<RegistrationChallenge | null> {
        return Models.RegistrationChallenge.findOne({ userId: TESTER.id });
    }

    it("grades a passing plan, marks the challenge complete, and sends the email", async () => {
        setUploadedFile(SAMPLE_PLAN);

        const response = await postAsUser("/registration/challenge/").expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({
            instanceId: "tier1-sample",
            attempts: 1,
            complete: true,
            bestScore: 300,
            normalizedScore: 1,
            lastReport: { score: 300, completed: 3, onTime: 3, errors: [] },
        });
        expect(sendMail).toHaveBeenCalledTimes(1);
        expect(sendMail).toBeCalledWith(Templates.CHALLENGE_COMPLETION, APPLICATION.email, { name: APPLICATION.firstName });

        const admission = await Models.AdmissionDecision.findOne({ userId: TESTER.id });
        expect(admission?.correctProChallenge).toBe(true);
        expect(admission?.proChallengeScore).toBe(1);
    });

    it("records a low score without passing", async () => {
        setUploadedFile(ONE_ORDER_PLAN);

        const response = await postAsUser("/registration/challenge/").expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({ attempts: 1, complete: false, bestScore: 100 });
        expect(sendMail).not.toHaveBeenCalled();

        const admission = await Models.AdmissionDecision.findOne({ userId: TESTER.id });
        expect(admission?.correctProChallenge).toBe(false);
        expect(admission?.proChallengeScore).toBeCloseTo(1 / 3);
    });

    it("keeps the best score when a later plan is worse", async () => {
        setUploadedFile(SAMPLE_PLAN);
        await postAsUser("/registration/challenge/").expect(StatusCode.SuccessOK);

        setUploadedFile(ONE_ORDER_PLAN);
        const response = await postAsUser("/registration/challenge/").expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({
            attempts: 2,
            complete: true,
            bestScore: 300,
            lastReport: { score: 100 },
        });
        const admission = await Models.AdmissionDecision.findOne({ userId: TESTER.id });
        expect(admission?.proChallengeScore).toBe(1);
    });

    it("lets applicants resubmit after passing without a second email", async () => {
        setUploadedFile(SAMPLE_PLAN);
        await postAsUser("/registration/challenge/").expect(StatusCode.SuccessOK);
        await postAsUser("/registration/challenge/").expect(StatusCode.SuccessOK);

        expect(sendMail).toHaveBeenCalledTimes(1);
        expect((await getStoredChallenge())?.attempts).toBe(2);
    });

    it("passes once the best score crosses the threshold", async () => {
        setUploadedFile(ONE_ORDER_PLAN);
        await postAsUser("/registration/challenge/").expect(StatusCode.SuccessOK);
        expect(sendMail).not.toHaveBeenCalled();

        setUploadedFile(SAMPLE_PLAN);
        const response = await postAsUser("/registration/challenge/").expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject({ complete: true, bestScore: 300 });
        expect(sendMail).toHaveBeenCalledTimes(1);
    });

    it("returns route errors for invalid commands but still scores earlier orders", async () => {
        setUploadedFile({
            ...ONE_ORDER_PLAN,
            routes: { "speedster-1": [...ONE_ORDER_PLAN.routes["speedster-1"], { t: 11, cmd: "go", to: "T2" }] },
        });

        const response = await postAsUser("/registration/challenge/").expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text).lastReport).toMatchObject({
            score: 100,
            errors: [{ driver: "speedster-1", index: 4, message: "speedster-1[4]: go to T2 at t=11, earliest possible t=14" }],
        });
    });

    it("never passes on an uncalibrated instance, but still records the score", async () => {
        removeSampleInstance();
        useCalibratedSampleInstance(null);
        setUploadedFile(SAMPLE_PLAN);

        const response = await postAsUser("/registration/challenge/").expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({ complete: false, bestScore: 300, normalizedScore: null });
        expect(sendMail).not.toHaveBeenCalled();
        const admission = await Models.AdmissionDecision.findOne({ userId: TESTER.id });
        expect(admission?.correctProChallenge).toBe(false);
    });

    it("rejects a broken file with a reason and counts the attempt", async () => {
        setUploadedFile({ ...SAMPLE_PLAN, routes: { "disguiser-9": [] } });

        const response = await postAsUser("/registration/challenge/").expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toEqual({
            error: "InvalidPlan",
            message: "Your plan.json couldn't be graded",
            reason: 'routes has unknown driver "disguiser-9"',
        });
        const stored = await getStoredChallenge();
        expect(stored?.attempts).toBe(1);
        expect(stored?.bestScore).toBe(0);
    });

    it("rejects invalid JSON", async () => {
        setUploadedFile("{ not json");

        const response = await postAsUser("/registration/challenge/").expect(StatusCode.ClientErrorBadRequest);
        expect(JSON.parse(response.text)).toHaveProperty("error", "InvalidPlan");
    });

    it("provides bad request error when no file is uploaded", async () => {
        const response = await postAsUser("/registration/challenge/").expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NoFileUploaded");
    });

    it("provides bad request error when no challenge exists", async () => {
        await Models.RegistrationChallenge.deleteOne({ userId: TESTER.id });
        setUploadedFile(SAMPLE_PLAN);

        const response = await postAsUser("/registration/challenge/").expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NoChallengeFound");
    });

    it("provides bad request error when no registration exists", async () => {
        await Models.RegistrationApplicationSubmitted.deleteOne({ userId: TESTER.id });
        setUploadedFile(SAMPLE_PLAN);

        const response = await postAsUser("/registration/challenge/").expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NoChallengeFound");
    });

    it("provides a forbidden error when registration is closed", async () => {
        const registrationLib = require("./registration-lib") as typeof RegistrationLib;
        jest.spyOn(registrationLib, "isRegistrationAlive").mockReturnValue(false);
        setUploadedFile(SAMPLE_PLAN);

        const response = await postAsUser("/registration/challenge/").expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "RegistrationClosed");
        expect((await getStoredChallenge())?.attempts).toBe(0);
    });
});

describe("Saloon Mercenary tiers 2 and 3", () => {
    let sendMail: jest.SpiedFunction<typeof MailLib.sendMail> = undefined!;
    let getWorldFile: jest.SpiedFunction<typeof ChallengeLib.getWorldFile> = undefined!;

    beforeEach(async (): Promise<void> => {
        await Models.RegistrationApplicationSubmitted.create(SUBMITTED_REGISTRATION);
        await Models.RegistrationChallenge.create(CHALLENGE);
        await Models.AdmissionDecision.create({ userId: TESTER.id, status: "TBD", response: "PENDING" });

        // Every world scores like the sample (reference 300), and all three tiers are live
        Config.PRO_CHALLENGE_TIERS = [1, 2, 3];
        Config.CHALLENGE_LOCAL_REFERENCE_SCORE = SAMPLE_REFERENCE_SCORE;
        Config.CHALLENGE_SUBMIT_COOLDOWN_SECONDS = 0;
        getWorldFile = mockGetWorldFile();
        sendMail = mockSendMail();
        sendMail.mockImplementation(async () => "");
    });

    afterEach((): void => {
        delete (global as { mockFile?: Express.Multer.File }).mockFile;
        Config.PRO_CHALLENGE_TIERS = DEFAULT_TIERS;
        Config.CHALLENGE_LOCAL_REFERENCE_SCORE = undefined;
        Config.CHALLENGE_SUBMIT_COOLDOWN_SECONDS = DEFAULT_COOLDOWN_SECONDS;
    });

    it("lists every live tier and assigns each one a world", async () => {
        const response = await getAsUser("/registration/challenge/").expect(StatusCode.SuccessOK);
        const body = JSON.parse(response.text);

        expect(body.instanceId).toBe("tier1-sample");
        expect(body.overallScore).toBe(0);
        expect(body.tiers.map((t: { tier: number; instanceId: string }) => [t.tier, t.instanceId])).toEqual([
            [1, "tier1-sample"],
            [2, assignInstance(TESTER.id, 2)],
            [3, assignInstance(TESTER.id, 3)],
        ]);
        const stored = await Models.RegistrationChallenge.findOne({ userId: TESTER.id });
        expect(stored?.tier2?.instanceId).toBe(assignInstance(TESTER.id, 2));
        expect(stored?.tier3?.instanceId).toBe(assignInstance(TESTER.id, 3));
    });

    it("downloads a tier's world", async () => {
        await getAsUser("/registration/challenge/world/2/").expect(StatusCode.SuccessOK);
        expect(getWorldFile).toHaveBeenCalledWith(assignInstance(TESTER.id, 2));
    });

    it("grades each tier separately and passes on the average", async () => {
        setUploadedFile(SAMPLE_PLAN);
        const afterTier2 = JSON.parse((await postAsUser("/registration/challenge/2/").expect(StatusCode.SuccessOK)).text);
        expect(afterTier2).toMatchObject({ bestScore: 0, attempts: 0, complete: false, overallScore: 1 / 3 });
        expect(afterTier2.tiers[1]).toMatchObject({ tier: 2, bestScore: 300, attempts: 1, normalizedScore: 1 });

        expect(sendMail).not.toHaveBeenCalled();

        // Tiers 1 + 2 average 2/3, which clears the 0.6 bar
        const passed = JSON.parse((await postAsUser("/registration/challenge/").expect(StatusCode.SuccessOK)).text);
        expect(passed).toMatchObject({ complete: true, overallScore: 2 / 3 });
        expect(sendMail).toHaveBeenCalledTimes(1);

        const all = JSON.parse((await postAsUser("/registration/challenge/3/").expect(StatusCode.SuccessOK)).text);
        expect(all).toMatchObject({ complete: true, overallScore: 1 });
        expect(sendMail).toHaveBeenCalledTimes(1);
        const admission = await Models.AdmissionDecision.findOne({ userId: TESTER.id });
        expect(admission).toMatchObject({ correctProChallenge: true, proChallengeScore: 1 });
    });

    it("keeps the plan with fewer walking minutes when scores tie", async () => {
        const detour = {
            instance: "tier1-sample",
            routes: {
                "speedster-1": [
                    { t: 5, cmd: "go", to: "T1" },
                    { t: 5, cmd: "pickup", order: "O1" },
                    { t: 10, cmd: "go", to: "F2" },
                    { t: 12, cmd: "go", to: "F1" },
                    { t: 12, cmd: "dropoff", order: "O1" },
                ],
            },
        };
        setUploadedFile(detour);
        await postAsUser("/registration/challenge/2/").expect(StatusCode.SuccessOK);
        setUploadedFile(ONE_ORDER_PLAN);
        await postAsUser("/registration/challenge/2/").expect(StatusCode.SuccessOK);
        setUploadedFile(detour);
        await postAsUser("/registration/challenge/2/").expect(StatusCode.SuccessOK);

        const stored = await Models.RegistrationChallenge.findOne({ userId: TESTER.id });
        expect(stored?.tier2).toMatchObject({ bestScore: 100, bestTravelMinutes: 10, attempts: 3 });
    });

    it("limits uploads to one per cooldown per tier, counting broken files", async () => {
        Config.CHALLENGE_SUBMIT_COOLDOWN_SECONDS = 60;
        setUploadedFile("{ not json");
        await postAsUser("/registration/challenge/").expect(StatusCode.ClientErrorBadRequest);

        setUploadedFile(SAMPLE_PLAN);
        const tooSoon = await postAsUser("/registration/challenge/").expect(StatusCode.ClientErrorTooManyRequests);
        const body = JSON.parse(tooSoon.text);
        expect(body).toMatchObject({ error: "SubmissionTooSoon" });
        expect(body.retryAfterSeconds).toBeGreaterThan(0);
        expect(body.retryAfterSeconds).toBeLessThanOrEqual(60);
        expect(tooSoon.headers["retry-after"]).toBe(`${body.retryAfterSeconds}`);

        // Other tiers have their own cooldown
        await postAsUser("/registration/challenge/2/").expect(StatusCode.SuccessOK);

        const status = JSON.parse((await getAsUser("/registration/challenge/").expect(StatusCode.SuccessOK)).text);
        expect(status.attempts).toBe(1);
        expect(status.tiers[0].nextSubmitAt).toBeGreaterThan(Date.now());
    });

    it("rejects tiers that aren't live", async () => {
        Config.PRO_CHALLENGE_TIERS = [1];
        setUploadedFile(SAMPLE_PLAN);

        const post = await postAsUser("/registration/challenge/3/").expect(StatusCode.ClientErrorNotFound);
        expect(JSON.parse(post.text)).toHaveProperty("error", "TierNotAvailable");
        const world = await getAsUser("/registration/challenge/world/2/").expect(StatusCode.ClientErrorNotFound);
        expect(JSON.parse(world.text)).toHaveProperty("error", "TierNotAvailable");
        await getAsUser("/registration/challenge/world/9/").expect(StatusCode.ClientErrorBadRequest);
    });
});

describe("GET /registration/challenge/leaderboard/", () => {
    beforeEach(async () => {
        await Models.RegistrationApplicationSubmitted.create(SUBMITTED_REGISTRATION);
        const others = [
            { userId: "github-a", overallScore: 0.9, overallTravelMinutes: 200, overallAt: 5 },
            { userId: "github-b", overallScore: 1.1, overallTravelMinutes: 300, overallAt: 9 },
            { userId: "github-c", overallScore: 0.9, overallTravelMinutes: 150, overallAt: 7 },
            { userId: "github-d", overallScore: 0.9, overallTravelMinutes: 150, overallAt: 3 },
            { userId: "github-e" },
        ];
        await Models.RegistrationChallenge.create([
            ...others.map((o) => ({ instanceId: "tier1-01", attempts: 1, complete: false, ...o })),
            { ...CHALLENGE, overallScore: 1.0, overallTravelMinutes: 100, overallAt: 1 },
        ]);
    });

    it("ranks by score, then fewer walking minutes, then who got there first, without names", async () => {
        const response = await getAsUser("/registration/challenge/leaderboard/").expect(StatusCode.SuccessOK);
        const body = JSON.parse(response.text);

        expect(body.total).toBe(5);
        expect(body.yourRank).toBe(2);
        expect(body.entries.map((e: { overallScore: number; you: boolean }) => [e.overallScore, e.you])).toEqual([
            [1.1, false],
            [1.0, true],
            [0.9, false],
            [0.9, false],
            [0.9, false],
        ]);
        expect(body.entries.map((e: { rank: number }) => e.rank)).toEqual([1, 2, 3, 4, 5]);
        expect(response.text).not.toContain("github");
    });

    it("respects the limit", async () => {
        const response = await getAsUser("/registration/challenge/leaderboard/?limit=2").expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text).entries).toHaveLength(2);
    });

    it("requires a submitted pro registration", async () => {
        await Models.RegistrationApplicationSubmitted.updateOne({ userId: TESTER.id }, { pro: false });
        await getAsUser("/registration/challenge/leaderboard/").expect(StatusCode.ClientErrorForbidden);
    });
});
