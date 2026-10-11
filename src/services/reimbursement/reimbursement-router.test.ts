import { describe, it } from "@jest/globals";
import { StatusCode } from "status-code-enum";
import { get, getAsAdmin, getAsAttendee, getAsUser, post, postAsUser } from "../../common/testTools";

const NOT_IMPLEMENTED = {
    error: "NotImplemented",
    message: "Receipt reimbursement is not implemented yet",
};

const RECEIPT_ID = "6612a3f4c2b1e5d7a8f90123";

const CREATE_REQUEST = {
    expenseDate: "2026-04-12",
    requestedAmountCents: 4500,
    currency: "USD",
    contentType: "image/heic",
    fileName: "bus-ticket.heic",
};

describe("POST /reimbursement/receipts/", () => {
    it("is not implemented yet", async () => {
        await postAsUser("/reimbursement/receipts/")
            .send(CREATE_REQUEST)
            .expect(StatusCode.ServerErrorNotImplemented, NOT_IMPLEMENTED);
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

    it("rejects unauthenticated requests", async () => {
        await post("/reimbursement/receipts/").send(CREATE_REQUEST).expect(StatusCode.ClientErrorUnauthorized);
    });
});

describe("GET /reimbursement/receipts/", () => {
    it("is not implemented yet", async () => {
        await getAsUser("/reimbursement/receipts/").expect(StatusCode.ServerErrorNotImplemented, NOT_IMPLEMENTED);
    });

    it("rejects unauthenticated requests", async () => {
        await get("/reimbursement/receipts/").expect(StatusCode.ClientErrorUnauthorized);
    });
});

describe("GET /reimbursement/receipts/all/", () => {
    it("is not implemented yet", async () => {
        await getAsAdmin("/reimbursement/receipts/all/").expect(StatusCode.ServerErrorNotImplemented, NOT_IMPLEMENTED);
    });

    it("rejects non-admins", async () => {
        await getAsAttendee("/reimbursement/receipts/all/").expect(StatusCode.ClientErrorForbidden);
    });
});

describe("GET /reimbursement/receipts/:id/", () => {
    it("is not implemented yet", async () => {
        await getAsUser(`/reimbursement/receipts/${RECEIPT_ID}/`).expect(StatusCode.ServerErrorNotImplemented, NOT_IMPLEMENTED);
    });

    it("rejects unauthenticated requests", async () => {
        await get(`/reimbursement/receipts/${RECEIPT_ID}/`).expect(StatusCode.ClientErrorUnauthorized);
    });
});

describe("POST /reimbursement/receipts/:id/complete/", () => {
    it("is not implemented yet", async () => {
        await postAsUser(`/reimbursement/receipts/${RECEIPT_ID}/complete/`).expect(
            StatusCode.ServerErrorNotImplemented,
            NOT_IMPLEMENTED,
        );
    });

    it("rejects unauthenticated requests", async () => {
        await post(`/reimbursement/receipts/${RECEIPT_ID}/complete/`).expect(StatusCode.ClientErrorUnauthorized);
    });
});

describe("GET /reimbursement/receipts/:id/download/", () => {
    it("is not implemented yet", async () => {
        await getAsUser(`/reimbursement/receipts/${RECEIPT_ID}/download/`).expect(
            StatusCode.ServerErrorNotImplemented,
            NOT_IMPLEMENTED,
        );
    });

    it("rejects unauthenticated requests", async () => {
        await get(`/reimbursement/receipts/${RECEIPT_ID}/download/`).expect(StatusCode.ClientErrorUnauthorized);
    });
});
