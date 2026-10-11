import { Router } from "express";
import { StatusCode } from "status-code-enum";
import { z } from "zod";
import { Role } from "../auth/auth-schemas";
import specification, { Tag } from "../../middleware/specification";
import {
    ReceiptDownloadURLSchema,
    ReceiptIdSchema,
    ReceiptSubmissionCreateRequestSchema,
    ReceiptSubmissionCreateResponseSchema,
    ReceiptSubmissionSchema,
    ReceiptSubmissionsSchema,
    ReimbursementNotImplementedError,
    ReimbursementNotImplementedErrorSchema,
} from "./reimbursement-schemas";

// TODO: These routes are stubs that document the API contract. They will be backed by MongoDB
// and S3 presigned URLs (mirroring the resume service) once the receipt bucket is provisioned.
const reimbursementRouter = Router();

const NotImplementedResponse = {
    [StatusCode.ServerErrorNotImplemented]: {
        description: "Not implemented yet",
        schema: ReimbursementNotImplementedErrorSchema,
    },
};

reimbursementRouter.post(
    "/receipts/",
    specification({
        method: "post",
        path: "/reimbursement/receipts/",
        tag: Tag.REIMBURSEMENT,
        role: Role.USER,
        summary: "Creates a receipt submission and returns a presigned upload url",
        body: ReceiptSubmissionCreateRequestSchema,
        responses: {
            [StatusCode.SuccessCreated]: {
                description: "The created submission and upload url",
                schema: ReceiptSubmissionCreateResponseSchema,
            },
            ...NotImplementedResponse,
        },
    }),
    async (_req, res) => res.status(StatusCode.ServerErrorNotImplemented).send(ReimbursementNotImplementedError),
);

reimbursementRouter.get(
    "/receipts/",
    specification({
        method: "get",
        path: "/reimbursement/receipts/",
        tag: Tag.REIMBURSEMENT,
        role: Role.USER,
        summary: "Lists the receipt submissions of the currently authenticated user",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The user's submissions",
                schema: ReceiptSubmissionsSchema,
            },
            ...NotImplementedResponse,
        },
    }),
    async (_req, res) => res.status(StatusCode.ServerErrorNotImplemented).send(ReimbursementNotImplementedError),
);

// Must be registered before /receipts/:id/ so "all" isn't treated as an id
reimbursementRouter.get(
    "/receipts/all/",
    specification({
        method: "get",
        path: "/reimbursement/receipts/all/",
        tag: Tag.REIMBURSEMENT,
        role: Role.ADMIN,
        summary: "Lists all receipt submissions",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "All submissions",
                schema: ReceiptSubmissionsSchema,
            },
            ...NotImplementedResponse,
        },
    }),
    async (_req, res) => res.status(StatusCode.ServerErrorNotImplemented).send(ReimbursementNotImplementedError),
);

reimbursementRouter.get(
    "/receipts/:id/",
    specification({
        method: "get",
        path: "/reimbursement/receipts/{id}/",
        tag: Tag.REIMBURSEMENT,
        role: Role.USER,
        summary: "Gets a receipt submission",
        description: "Only the owner of the submission or an admin can view it",
        parameters: z.object({
            id: ReceiptIdSchema,
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The submission",
                schema: ReceiptSubmissionSchema,
            },
            ...NotImplementedResponse,
        },
    }),
    async (_req, res) => res.status(StatusCode.ServerErrorNotImplemented).send(ReimbursementNotImplementedError),
);

reimbursementRouter.post(
    "/receipts/:id/complete/",
    specification({
        method: "post",
        path: "/reimbursement/receipts/{id}/complete/",
        tag: Tag.REIMBURSEMENT,
        role: Role.USER,
        summary: "Marks the receipt file upload of a submission as complete",
        description: "Called by the owner after successfully uploading the file to the presigned url",
        parameters: z.object({
            id: ReceiptIdSchema,
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The updated submission",
                schema: ReceiptSubmissionSchema,
            },
            ...NotImplementedResponse,
        },
    }),
    async (_req, res) => res.status(StatusCode.ServerErrorNotImplemented).send(ReimbursementNotImplementedError),
);

reimbursementRouter.get(
    "/receipts/:id/download/",
    specification({
        method: "get",
        path: "/reimbursement/receipts/{id}/download/",
        tag: Tag.REIMBURSEMENT,
        role: Role.USER,
        summary: "Gets a presigned download url for a submission's receipt file",
        description: "Only the owner of the submission or an admin can download it",
        parameters: z.object({
            id: ReceiptIdSchema,
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The download url",
                schema: ReceiptDownloadURLSchema,
            },
            ...NotImplementedResponse,
        },
    }),
    async (_req, res) => res.status(StatusCode.ServerErrorNotImplemented).send(ReimbursementNotImplementedError),
);

export default reimbursementRouter;
