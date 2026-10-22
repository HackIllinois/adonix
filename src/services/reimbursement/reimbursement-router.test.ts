import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { StatusCode } from "status-code-enum";
import Models from "../../common/models";
import {
    TESTER,
    del,
    delAsAttendee,
    delAsUser,
    get,
    getAsAdmin,
    getAsAttendee,
    getAsUser,
    patchAsAdmin,
    patchAsStaff,
    post,
    postAsUser,
} from "../../common/testTools";
import { ReceiptStatus } from "./reimbursement-schemas";
import type * as ReimbursementService from "./reimbursement-service";

const MOCK_UPLOAD_URL = "https://resume-bucket-dev.s3.us-east-2.amazonaws.com/";
const MOCK_DOWNLOAD_URL = "https://resume-bucket-dev.s3.us-east-2.amazonaws.com/receipt.heic";

const OTHER_USER_ID = "github9999";
const MISSING_ID = "6612a3f4c2b1e5d7a8f90123";

const CREATE_REQUEST = {
    expenseDate: "2026-04-12",
    requestedAmountCents: 4500,
    currency: "USD",
    contentType: "image/heic",
    fileName: "bus-ticket.heic",
};

const RECEIPT = {
    userId: TESTER.id,
    expenseDate: "2026-04-12",
    requestedAmountCents: 4500,
    currency: "USD",
    contentType: "image/heic",
    originalFileName: "bus-ticket.heic",
    s3Key: `receipts/${TESTER.id}/receipt.heic`,
};

function mockReimbursementService(): {
    createSignedReceiptPostUrl: jest.SpiedFunction<typeof ReimbursementService.createSignedReceiptPostUrl>;
    getSignedReceiptDownloadUrl: jest.SpiedFunction<typeof ReimbursementService.getSignedReceiptDownloadUrl>;
    receiptFileExists: jest.SpiedFunction<typeof ReimbursementService.receiptFileExists>;
    deleteReceiptFile: jest.SpiedFunction<typeof ReimbursementService.deleteReceiptFile>;
} {
    const service = require("./reimbursement-service") as typeof ReimbursementService;

    const createSignedReceiptPostUrl = jest.spyOn(service, "createSignedReceiptPostUrl");
    const getSignedReceiptDownloadUrl = jest.spyOn(service, "getSignedReceiptDownloadUrl");
    const receiptFileExists = jest.spyOn(service, "receiptFileExists");
    const deleteReceiptFile = jest.spyOn(service, "deleteReceiptFile");

    createSignedReceiptPostUrl.mockImplementation(async (key, contentType) => ({
        url: MOCK_UPLOAD_URL,
        fields: { success_action_status: "201", "Content-Type": contentType, key },
    }));
    getSignedReceiptDownloadUrl.mockResolvedValue(MOCK_DOWNLOAD_URL);
    receiptFileExists.mockResolvedValue(true);
    deleteReceiptFile.mockResolvedValue();

    return { createSignedReceiptPostUrl, getSignedReceiptDownloadUrl, receiptFileExists, deleteReceiptFile };
}

let mocks: ReturnType<typeof mockReimbursementService>;

beforeEach(async () => {
    await Models.ReceiptSubmission.deleteMany({});
    mocks = mockReimbursementService();
});

async function createReceipt(overrides: object = {}): Promise<string> {
    const receipt = await Models.ReceiptSubmission.create({ ...RECEIPT, ...overrides });
    return receipt._id.toString();
}

function createCompletedReceipt(overrides: object = {}): Promise<string> {
    return createReceipt({ uploadCompletedAt: new Date(), ...overrides });
}

describe("POST /reimbursement/receipts/", () => {
    it("creates a pending submission and returns an upload url", async () => {
        const response = await postAsUser("/reimbursement/receipts/").send(CREATE_REQUEST).expect(StatusCode.SuccessCreated);
        const json = JSON.parse(response.text);

        expect(json).toMatchObject({ url: MOCK_UPLOAD_URL, s3Key: `receipts/${TESTER.id}/${json.id}.heic` });
        expect(json.fields).toMatchObject({ "Content-Type": "image/heic", key: json.s3Key });

        const stored = await Models.ReceiptSubmission.findById(json.id).lean();
        expect(stored).toMatchObject({
            userId: TESTER.id,
            requestedAmountCents: 4500,
            originalFileName: "bus-ticket.heic",
            status: ReceiptStatus.PENDING,
            uploadCompletedAt: null,
        });
    });

    it("rejects unsupported content types", async () => {
        await postAsUser("/reimbursement/receipts/")
            .send({ ...CREATE_REQUEST, contentType: "text/plain" })
            .expect(StatusCode.ClientErrorBadRequest);
    });

    it("rejects non-positive amounts", async () => {
        await postAsUser("/reimbursement/receipts/")
            .send({ ...CREATE_REQUEST, requestedAmountCents: 0 })
            .expect(StatusCode.ClientErrorBadRequest);
    });

    it("rejects invalid dates", async () => {
        await postAsUser("/reimbursement/receipts/")
            .send({ ...CREATE_REQUEST, expenseDate: "April 12" })
            .expect(StatusCode.ClientErrorBadRequest);
    });

    it("rejects unauthenticated requests", async () => {
        await post("/reimbursement/receipts/").send(CREATE_REQUEST).expect(StatusCode.ClientErrorUnauthorized);
    });
});

describe("GET /reimbursement/receipts/", () => {
    it("lists only the user's submissions, newest first", async () => {
        const older = await createReceipt({ createdAt: new Date("2026-04-01") });
        const newer = await createReceipt({ createdAt: new Date("2026-04-02") });
        await createReceipt({ userId: OTHER_USER_ID });

        const response = await getAsUser("/reimbursement/receipts/").expect(StatusCode.SuccessOK);
        const ids = JSON.parse(response.text).submissions.map((s: { id: string }) => s.id);
        expect(ids).toEqual([newer, older]);
    });

    it("rejects unauthenticated requests", async () => {
        await get("/reimbursement/receipts/").expect(StatusCode.ClientErrorUnauthorized);
    });
});

describe("GET /reimbursement/receipts/all/", () => {
    it("lists every submission oldest first", async () => {
        const newer = await createReceipt({ createdAt: new Date("2026-04-02") });
        const older = await createReceipt({ userId: OTHER_USER_ID, createdAt: new Date("2026-04-01") });

        const response = await getAsAdmin("/reimbursement/receipts/all/").expect(StatusCode.SuccessOK);
        const ids = JSON.parse(response.text).submissions.map((s: { id: string }) => s.id);
        expect(ids).toEqual([older, newer]);
    });

    it("filters by status and user", async () => {
        await createCompletedReceipt({ status: ReceiptStatus.APPROVED });
        const pending = await createReceipt({ userId: OTHER_USER_ID });
        await createReceipt();

        const response = await getAsAdmin(`/reimbursement/receipts/all/?status=pending&userId=${OTHER_USER_ID}`).expect(
            StatusCode.SuccessOK,
        );
        const ids = JSON.parse(response.text).submissions.map((s: { id: string }) => s.id);
        expect(ids).toEqual([pending]);
    });

    it("rejects non-admins", async () => {
        await getAsAttendee("/reimbursement/receipts/all/").expect(StatusCode.ClientErrorForbidden);
    });
});

describe("GET /reimbursement/receipts/:id/", () => {
    it("returns the owner's submission", async () => {
        const id = await createReceipt();
        const response = await getAsUser(`/reimbursement/receipts/${id}/`).expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject({ id, userId: TESTER.id, status: ReceiptStatus.PENDING });
    });

    it("hides internal reviewer notes from the owner", async () => {
        const id = await createCompletedReceipt({ status: ReceiptStatus.APPROVED, reviewerNotes: "Paid via Venmo" });

        const own = await getAsUser(`/reimbursement/receipts/${id}/`).expect(StatusCode.SuccessOK);
        expect(JSON.parse(own.text)).toHaveProperty("reviewerNotes", null);

        const list = await getAsUser("/reimbursement/receipts/").expect(StatusCode.SuccessOK);
        expect(JSON.parse(list.text).submissions[0]).toHaveProperty("reviewerNotes", null);

        const admin = await getAsAdmin(`/reimbursement/receipts/${id}/`).expect(StatusCode.SuccessOK);
        expect(JSON.parse(admin.text)).toHaveProperty("reviewerNotes", "Paid via Venmo");
    });

    it("lets admins view anyone's submission", async () => {
        const id = await createReceipt({ userId: OTHER_USER_ID });
        await getAsAdmin(`/reimbursement/receipts/${id}/`).expect(StatusCode.SuccessOK);
    });

    it("forbids viewing other users' submissions", async () => {
        const id = await createReceipt({ userId: OTHER_USER_ID });
        const response = await getAsUser(`/reimbursement/receipts/${id}/`).expect(StatusCode.ClientErrorForbidden);
        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("returns not found for unknown ids", async () => {
        const response = await getAsUser(`/reimbursement/receipts/${MISSING_ID}/`).expect(StatusCode.ClientErrorNotFound);
        expect(JSON.parse(response.text)).toHaveProperty("error", "NotFound");
    });

    it("rejects malformed ids", async () => {
        await getAsUser("/reimbursement/receipts/not-an-id/").expect(StatusCode.ClientErrorBadRequest);
    });

    it("rejects unauthenticated requests", async () => {
        await get(`/reimbursement/receipts/${MISSING_ID}/`).expect(StatusCode.ClientErrorUnauthorized);
    });
});

describe("DELETE /reimbursement/receipts/:id/", () => {
    it("lets the owner withdraw a pending submission", async () => {
        const id = await createReceipt();
        await delAsUser(`/reimbursement/receipts/${id}/`).expect(StatusCode.SuccessOK);

        expect(await Models.ReceiptSubmission.findById(id)).toBeNull();
        expect(mocks.deleteReceiptFile).toHaveBeenCalledWith(RECEIPT.s3Key);
    });

    it("doesn't delete reviewed submissions", async () => {
        const id = await createCompletedReceipt({ status: ReceiptStatus.APPROVED });
        const response = await delAsUser(`/reimbursement/receipts/${id}/`).expect(StatusCode.ClientErrorConflict);

        expect(JSON.parse(response.text)).toHaveProperty("error", "AlreadyReviewed");
        expect(await Models.ReceiptSubmission.findById(id)).not.toBeNull();
    });

    it("forbids deleting other users' submissions", async () => {
        const id = await createReceipt({ userId: OTHER_USER_ID });
        await delAsAttendee(`/reimbursement/receipts/${id}/`).expect(StatusCode.ClientErrorForbidden);
        expect(await Models.ReceiptSubmission.findById(id)).not.toBeNull();
    });

    it("rejects unauthenticated requests", async () => {
        await del(`/reimbursement/receipts/${MISSING_ID}/`).expect(StatusCode.ClientErrorUnauthorized);
    });
});

describe("POST /reimbursement/receipts/:id/complete/", () => {
    it("marks the upload complete once the file exists", async () => {
        const id = await createReceipt();
        const response = await postAsUser(`/reimbursement/receipts/${id}/complete/`).expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text).uploadCompletedAt).not.toBeNull();
        expect(mocks.receiptFileExists).toHaveBeenCalledWith(RECEIPT.s3Key);
    });

    it("fails if the file wasn't uploaded", async () => {
        mocks.receiptFileExists.mockResolvedValue(false);
        const id = await createReceipt();

        const response = await postAsUser(`/reimbursement/receipts/${id}/complete/`).expect(StatusCode.ClientErrorBadRequest);
        expect(JSON.parse(response.text)).toHaveProperty("error", "FileMissing");
        expect((await Models.ReceiptSubmission.findById(id))?.uploadCompletedAt).toBeNull();
    });

    it("is idempotent", async () => {
        const completedAt = new Date("2026-04-12T18:00:00.000Z");
        const id = await createReceipt({ uploadCompletedAt: completedAt });

        const response = await postAsUser(`/reimbursement/receipts/${id}/complete/`).expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text).uploadCompletedAt).toBe(completedAt.toISOString());
    });

    it("forbids completing other users' submissions", async () => {
        const id = await createReceipt({ userId: OTHER_USER_ID });
        await postAsUser(`/reimbursement/receipts/${id}/complete/`).expect(StatusCode.ClientErrorForbidden);
    });

    it("rejects unauthenticated requests", async () => {
        await post(`/reimbursement/receipts/${MISSING_ID}/complete/`).expect(StatusCode.ClientErrorUnauthorized);
    });
});

describe("GET /reimbursement/receipts/:id/download/", () => {
    it("returns a download url for the owner", async () => {
        const id = await createCompletedReceipt();
        const response = await getAsUser(`/reimbursement/receipts/${id}/download/`).expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toEqual({ url: MOCK_DOWNLOAD_URL });
        expect(mocks.getSignedReceiptDownloadUrl).toHaveBeenCalledWith(RECEIPT.s3Key);
    });

    it("returns a download url for admins", async () => {
        const id = await createCompletedReceipt({ userId: OTHER_USER_ID });
        await getAsAdmin(`/reimbursement/receipts/${id}/download/`).expect(StatusCode.SuccessOK);
    });

    it("fails before the upload completes", async () => {
        const id = await createReceipt();
        const response = await getAsUser(`/reimbursement/receipts/${id}/download/`).expect(StatusCode.ClientErrorBadRequest);
        expect(JSON.parse(response.text)).toHaveProperty("error", "UploadIncomplete");
    });

    it("forbids downloading other users' receipts", async () => {
        const id = await createCompletedReceipt({ userId: OTHER_USER_ID });
        await getAsUser(`/reimbursement/receipts/${id}/download/`).expect(StatusCode.ClientErrorForbidden);
    });

    it("rejects unauthenticated requests", async () => {
        await get(`/reimbursement/receipts/${MISSING_ID}/download/`).expect(StatusCode.ClientErrorUnauthorized);
    });
});

describe("PATCH /reimbursement/receipts/:id/review/", () => {
    it("approves a submission", async () => {
        const id = await createCompletedReceipt();
        const response = await patchAsAdmin(`/reimbursement/receipts/${id}/review/`)
            .send({ status: "approved", reviewerNotes: "Paid via Venmo" })
            .expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({
            status: ReceiptStatus.APPROVED,
            reviewedBy: TESTER.id,
            rejectionReason: null,
            reviewerNotes: "Paid via Venmo",
        });
        expect((await Models.ReceiptSubmission.findById(id))?.reviewedAt).toBeInstanceOf(Date);
    });

    it("rejects a submission with a reason", async () => {
        const id = await createCompletedReceipt();
        const response = await patchAsAdmin(`/reimbursement/receipts/${id}/review/`)
            .send({ status: "rejected", rejectionReason: "Receipt is unreadable" })
            .expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({
            status: ReceiptStatus.REJECTED,
            rejectionReason: "Receipt is unreadable",
            reviewerNotes: null,
        });
    });

    it("requires a reason to reject", async () => {
        const id = await createCompletedReceipt();
        await patchAsAdmin(`/reimbursement/receipts/${id}/review/`)
            .send({ status: "rejected" })
            .expect(StatusCode.ClientErrorBadRequest);
    });

    it("clears a previous decision when reset to pending", async () => {
        const id = await createCompletedReceipt({
            status: ReceiptStatus.REJECTED,
            reviewedAt: new Date(),
            reviewedBy: "someone",
            rejectionReason: "Blurry",
        });

        const response = await patchAsAdmin(`/reimbursement/receipts/${id}/review/`)
            .send({ status: "pending" })
            .expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({
            status: ReceiptStatus.PENDING,
            reviewedAt: null,
            reviewedBy: null,
            rejectionReason: null,
        });
    });

    it("can't review a submission whose upload isn't complete", async () => {
        const id = await createReceipt();
        const response = await patchAsAdmin(`/reimbursement/receipts/${id}/review/`)
            .send({ status: "approved" })
            .expect(StatusCode.ClientErrorBadRequest);
        expect(JSON.parse(response.text)).toHaveProperty("error", "UploadIncomplete");
    });

    it("returns not found for unknown ids", async () => {
        await patchAsAdmin(`/reimbursement/receipts/${MISSING_ID}/review/`)
            .send({ status: "approved" })
            .expect(StatusCode.ClientErrorNotFound);
    });

    it("rejects non-admins", async () => {
        const id = await createCompletedReceipt();
        await patchAsStaff(`/reimbursement/receipts/${id}/review/`)
            .send({ status: "approved" })
            .expect(StatusCode.ClientErrorForbidden);
        expect((await Models.ReceiptSubmission.findById(id))?.status).toBe(ReceiptStatus.PENDING);
    });
});
