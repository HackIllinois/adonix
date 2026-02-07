import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { StatusCode } from "status-code-enum";
import { TESTER, getAsUser, getAsAttendee, getAsAdmin, postAsAdmin, postAsAttendee, get, post } from "../../common/testTools";
import type * as ResumeService from "./resume-service";

const MOCK_DOWNLOAD_URL = "https://resume-bucket-dev.s3.us-east-2.amazonaws.com/test-user.pdf";
const MOCK_UPLOAD_URL = "https://resume-bucket-dev.s3.us-east-2.amazonaws.com/";
const MOCK_UPLOAD_FIELDS = {
    success_action_status: "201",
    "Content-Type": "application/pdf",
    bucket: "resume-bucket-dev",
    key: "test-user.pdf",
};

function mockResumeService(): {
    getSignedResumeDownloadUrl: jest.SpiedFunction<typeof ResumeService.getSignedResumeDownloadUrl>;
    createSignedResumePostUrl: jest.SpiedFunction<typeof ResumeService.createSignedResumePostUrl>;
    getSignedResumeDownloadUrlList: jest.SpiedFunction<typeof ResumeService.getSignedResumeDownloadUrlList>;
} {
    const resumeService = require("./resume-service") as typeof ResumeService;

    const getSignedResumeDownloadUrl = jest.spyOn(resumeService, "getSignedResumeDownloadUrl");
    const createSignedResumePostUrl = jest.spyOn(resumeService, "createSignedResumePostUrl");
    const getSignedResumeDownloadUrlList = jest.spyOn(resumeService, "getSignedResumeDownloadUrlList");

    return { getSignedResumeDownloadUrl, createSignedResumePostUrl, getSignedResumeDownloadUrlList };
}

describe("GET /resume/upload/", () => {
    let createSignedResumePostUrl: jest.SpiedFunction<typeof ResumeService.createSignedResumePostUrl>;

    beforeEach(() => {
        const mocks = mockResumeService();
        createSignedResumePostUrl = mocks.createSignedResumePostUrl;
        createSignedResumePostUrl.mockResolvedValue({
            url: MOCK_UPLOAD_URL,
            fields: MOCK_UPLOAD_FIELDS,
        });
    });

    it("returns upload url for authenticated user", async () => {
        const response = await getAsUser("/resume/upload/").expect(StatusCode.SuccessOK);

        const json = JSON.parse(response.text);
        expect(json).toHaveProperty("url", MOCK_UPLOAD_URL);
        expect(json).toHaveProperty("fields", MOCK_UPLOAD_FIELDS);
        expect(createSignedResumePostUrl).toHaveBeenCalledWith(TESTER.id);
    });

    it("rejects unauthenticated requests", async () => {
        await get("/resume/upload/").expect(StatusCode.ClientErrorUnauthorized);
    });
});

describe("GET /resume/download/", () => {
    let getSignedResumeDownloadUrl: jest.SpiedFunction<typeof ResumeService.getSignedResumeDownloadUrl>;

    beforeEach(() => {
        const mocks = mockResumeService();
        getSignedResumeDownloadUrl = mocks.getSignedResumeDownloadUrl;
        getSignedResumeDownloadUrl.mockResolvedValue(MOCK_DOWNLOAD_URL);
    });

    it("returns download url for authenticated user", async () => {
        const response = await getAsUser("/resume/download/").expect(StatusCode.SuccessOK);

        const json = JSON.parse(response.text);
        expect(json).toHaveProperty("url", MOCK_DOWNLOAD_URL);
        expect(getSignedResumeDownloadUrl).toHaveBeenCalledWith(TESTER.id);
    });

    it("rejects unauthenticated requests", async () => {
        await get("/resume/download/").expect(StatusCode.ClientErrorUnauthorized);
    });
});

describe("GET /resume/download/:id", () => {
    let getSignedResumeDownloadUrl: jest.SpiedFunction<typeof ResumeService.getSignedResumeDownloadUrl>;

    beforeEach(() => {
        const mocks = mockResumeService();
        getSignedResumeDownloadUrl = mocks.getSignedResumeDownloadUrl;
        getSignedResumeDownloadUrl.mockResolvedValue(MOCK_DOWNLOAD_URL);
    });

    it("returns download url for specified user when admin", async () => {
        const targetUserId = "target-user-123";
        const response = await getAsAdmin(`/resume/download/${targetUserId}`).expect(StatusCode.SuccessOK);

        const json = JSON.parse(response.text);
        expect(json).toHaveProperty("url", MOCK_DOWNLOAD_URL);
        expect(getSignedResumeDownloadUrl).toHaveBeenCalledWith(targetUserId);
    });

    it("rejects non-sponsor/admin users", async () => {
        await getAsAttendee("/resume/download/some-user-id").expect(StatusCode.ClientErrorForbidden);
    });

    it("rejects unauthenticated requests", async () => {
        await get("/resume/download/some-user-id").expect(StatusCode.ClientErrorUnauthorized);
    });
});

describe("POST /resume/batch/download/", () => {
    let getSignedResumeDownloadUrlList: jest.SpiedFunction<typeof ResumeService.getSignedResumeDownloadUrlList>;

    beforeEach(() => {
        const mocks = mockResumeService();
        getSignedResumeDownloadUrlList = mocks.getSignedResumeDownloadUrlList;
    });

    it("returns download urls for multiple users when admin", async () => {
        const userIds = ["user1", "user2", "user3"];
        const mockUrls = [
            "https://resume-bucket-dev.s3.us-east-2.amazonaws.com/user1.pdf",
            "https://resume-bucket-dev.s3.us-east-2.amazonaws.com/user2.pdf",
            "https://resume-bucket-dev.s3.us-east-2.amazonaws.com/user3.pdf",
        ];
        getSignedResumeDownloadUrlList.mockResolvedValue(mockUrls);

        const response = await postAsAdmin("/resume/batch/download/").send({ userIds }).expect(StatusCode.SuccessOK);

        const json = JSON.parse(response.text);
        expect(json).toHaveProperty("urls", mockUrls);
        expect(getSignedResumeDownloadUrlList).toHaveBeenCalledWith(userIds);
    });

    it("returns partial urls when some resumes don't exist", async () => {
        const userIds = ["user1", "user2", "user3"];
        const mockUrls = [
            "https://resume-bucket-dev.s3.us-east-2.amazonaws.com/user1.pdf",
            "https://resume-bucket-dev.s3.us-east-2.amazonaws.com/user3.pdf",
        ];
        getSignedResumeDownloadUrlList.mockResolvedValue(mockUrls);

        const response = await postAsAdmin("/resume/batch/download/").send({ userIds }).expect(StatusCode.SuccessOK);

        const json = JSON.parse(response.text);
        expect(json).toHaveProperty("urls", mockUrls);
        expect(json.urls).toHaveLength(2);
    });

    it("returns empty array when no resumes exist", async () => {
        const userIds = ["user1", "user2"];
        getSignedResumeDownloadUrlList.mockResolvedValue([]);

        const response = await postAsAdmin("/resume/batch/download/").send({ userIds }).expect(StatusCode.SuccessOK);

        const json = JSON.parse(response.text);
        expect(json).toHaveProperty("urls", []);
    });

    it("rejects non-sponsor/admin users", async () => {
        await postAsAttendee("/resume/batch/download/")
            .send({ userIds: ["user1"] })
            .expect(StatusCode.ClientErrorForbidden);
    });

    it("rejects unauthenticated requests", async () => {
        await post("/resume/batch/download/")
            .send({ userIds: ["user1"] })
            .expect(StatusCode.ClientErrorUnauthorized);
    });

    it("rejects invalid request body", async () => {
        await postAsAdmin("/resume/batch/download/").send({ invalidField: "test" }).expect(StatusCode.ClientErrorBadRequest);
    });
});
