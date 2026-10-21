import { Router } from "express";
import { StatusCode } from "status-code-enum";
import { Types } from "mongoose";
import { z } from "zod";
import { Role } from "../auth/auth-schemas";
import { getAuthenticatedUser } from "../../common/auth";
import Config from "../../common/config";
import Models from "../../common/models";
import specification, { Tag } from "../../middleware/specification";
import {
    ReceiptAlreadyReviewedError,
    ReceiptAlreadyReviewedErrorSchema,
    ReceiptDownloadURLSchema,
    ReceiptFileMissingError,
    ReceiptFileMissingErrorSchema,
    ReceiptForbiddenError,
    ReceiptForbiddenErrorSchema,
    ReceiptIdSchema,
    ReceiptNotFoundError,
    ReceiptNotFoundErrorSchema,
    ReceiptReviewRequestSchema,
    ReceiptStatus,
    ReceiptStatusSchema,
    ReceiptSubmissionCreateRequestSchema,
    ReceiptSubmissionCreateResponseSchema,
    ReceiptSubmissionSchema,
    ReceiptSubmissionsSchema,
    ReceiptUploadIncompleteError,
    ReceiptUploadIncompleteErrorSchema,
} from "./reimbursement-schemas";
import {
    createSignedReceiptPostUrl,
    deleteReceiptFile,
    getSignedReceiptDownloadUrl,
    receiptFileExists,
    receiptS3Key,
    toReceiptSubmission,
} from "./reimbursement-service";

const reimbursementRouter = Router();

const ReceiptIdParameters = z.object({
    id: ReceiptIdSchema,
});

const NotFoundResponse = {
    [StatusCode.ClientErrorNotFound]: {
        description: "Couldn't find the submission",
        schema: ReceiptNotFoundErrorSchema,
    },
};

const ForbiddenResponse = {
    [StatusCode.ClientErrorForbidden]: {
        description: "The submission belongs to another user",
        schema: ReceiptForbiddenErrorSchema,
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
        description:
            "Upload the file by POSTing `fields` and the file as multipart form data to `url`, " +
            `then call \`POST /reimbursement/receipts/{id}/complete/\`. The url is valid for ${Config.RECEIPT_URL_EXPIRY_SECONDS} seconds.`,
        body: ReceiptSubmissionCreateRequestSchema,
        responses: {
            [StatusCode.SuccessCreated]: {
                description: "The created submission and upload url",
                schema: ReceiptSubmissionCreateResponseSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);
        const { expenseDate, requestedAmountCents, currency, contentType, fileName } = req.body;

        const id = new Types.ObjectId();
        const s3Key = receiptS3Key(userId, id.toString(), contentType);
        const { url, fields } = await createSignedReceiptPostUrl(s3Key, contentType);

        await Models.ReceiptSubmission.create({
            _id: id,
            userId,
            expenseDate,
            requestedAmountCents,
            currency,
            contentType,
            originalFileName: fileName,
            s3Key,
        });

        return res.status(StatusCode.SuccessCreated).send({ id: id.toString(), url, fields, s3Key });
    },
);

reimbursementRouter.get(
    "/receipts/",
    specification({
        method: "get",
        path: "/reimbursement/receipts/",
        tag: Tag.REIMBURSEMENT,
        role: Role.USER,
        summary: "Lists the receipt submissions of the currently authenticated user",
        description: "Newest first",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The user's submissions",
                schema: ReceiptSubmissionsSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);
        const receipts = await Models.ReceiptSubmission.find({ userId }).sort({ createdAt: -1 }).lean();
        return res.status(StatusCode.SuccessOK).send({ submissions: receipts.map(toReceiptSubmission) });
    },
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
        description: "Oldest first. Includes submissions whose file upload hasn't completed.",
        query: z.object({
            status: ReceiptStatusSchema.optional(),
            userId: z.string().optional(),
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "All matching submissions",
                schema: ReceiptSubmissionsSchema,
            },
        },
    }),
    async (req, res) => {
        const { status, userId } = req.query;
        const filter = {
            ...(status && { status }),
            ...(userId && { userId }),
        };
        const receipts = await Models.ReceiptSubmission.find(filter).sort({ createdAt: 1 }).lean();
        return res.status(StatusCode.SuccessOK).send({ submissions: receipts.map(toReceiptSubmission) });
    },
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
        parameters: ReceiptIdParameters,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The submission",
                schema: ReceiptSubmissionSchema,
            },
            ...ForbiddenResponse,
            ...NotFoundResponse,
        },
    }),
    async (req, res) => {
        const { id: userId, roles } = getAuthenticatedUser(req);
        const receipt = await Models.ReceiptSubmission.findById(req.params.id).lean();

        if (!receipt) {
            return res.status(StatusCode.ClientErrorNotFound).send(ReceiptNotFoundError);
        }
        if (receipt.userId !== userId && !roles.includes(Role.ADMIN)) {
            return res.status(StatusCode.ClientErrorForbidden).send(ReceiptForbiddenError);
        }

        return res.status(StatusCode.SuccessOK).send(toReceiptSubmission(receipt));
    },
);

reimbursementRouter.delete(
    "/receipts/:id/",
    specification({
        method: "delete",
        path: "/reimbursement/receipts/{id}/",
        tag: Tag.REIMBURSEMENT,
        role: Role.USER,
        summary: "Withdraws a receipt submission",
        description: "Only the owner or an admin can delete a submission, and only while it's pending review",
        parameters: ReceiptIdParameters,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The deleted submission",
                schema: ReceiptSubmissionSchema,
            },
            ...ForbiddenResponse,
            ...NotFoundResponse,
            [StatusCode.ClientErrorConflict]: {
                description: "The submission has already been reviewed",
                schema: ReceiptAlreadyReviewedErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId, roles } = getAuthenticatedUser(req);
        const receipt = await Models.ReceiptSubmission.findById(req.params.id).lean();

        if (!receipt) {
            return res.status(StatusCode.ClientErrorNotFound).send(ReceiptNotFoundError);
        }
        if (receipt.userId !== userId && !roles.includes(Role.ADMIN)) {
            return res.status(StatusCode.ClientErrorForbidden).send(ReceiptForbiddenError);
        }
        if (receipt.status !== ReceiptStatus.PENDING) {
            return res.status(StatusCode.ClientErrorConflict).send(ReceiptAlreadyReviewedError);
        }

        await Models.ReceiptSubmission.deleteOne({ _id: receipt._id });
        // The record is gone either way, so a leftover file is harmless
        await deleteReceiptFile(receipt.s3Key).catch(() => undefined);

        return res.status(StatusCode.SuccessOK).send(toReceiptSubmission(receipt));
    },
);

reimbursementRouter.post(
    "/receipts/:id/complete/",
    specification({
        method: "post",
        path: "/reimbursement/receipts/{id}/complete/",
        tag: Tag.REIMBURSEMENT,
        role: Role.USER,
        summary: "Marks the receipt file upload of a submission as complete",
        description:
            "Called by the owner after successfully uploading the file to the presigned url. " +
            "Fails if the file isn't in storage. Calling it again is a no-op.",
        parameters: ReceiptIdParameters,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The updated submission",
                schema: ReceiptSubmissionSchema,
            },
            [StatusCode.ClientErrorBadRequest]: {
                description: "The file hasn't been uploaded",
                schema: ReceiptFileMissingErrorSchema,
            },
            ...ForbiddenResponse,
            ...NotFoundResponse,
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);
        const receipt = await Models.ReceiptSubmission.findById(req.params.id).lean();

        if (!receipt) {
            return res.status(StatusCode.ClientErrorNotFound).send(ReceiptNotFoundError);
        }
        if (receipt.userId !== userId) {
            return res.status(StatusCode.ClientErrorForbidden).send(ReceiptForbiddenError);
        }
        if (receipt.uploadCompletedAt) {
            return res.status(StatusCode.SuccessOK).send(toReceiptSubmission(receipt));
        }
        if (!(await receiptFileExists(receipt.s3Key))) {
            return res.status(StatusCode.ClientErrorBadRequest).send(ReceiptFileMissingError);
        }

        const updated = await Models.ReceiptSubmission.findByIdAndUpdate(
            receipt._id,
            { uploadCompletedAt: new Date() },
            { new: true },
        ).lean();

        return res.status(StatusCode.SuccessOK).send(toReceiptSubmission(updated!));
    },
);

reimbursementRouter.get(
    "/receipts/:id/download/",
    specification({
        method: "get",
        path: "/reimbursement/receipts/{id}/download/",
        tag: Tag.REIMBURSEMENT,
        role: Role.USER,
        summary: "Gets a presigned download url for a submission's receipt file",
        description: `Only the owner of the submission or an admin can download it. The url is valid for ${Config.RECEIPT_URL_EXPIRY_SECONDS} seconds.`,
        parameters: ReceiptIdParameters,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The download url",
                schema: ReceiptDownloadURLSchema,
            },
            [StatusCode.ClientErrorBadRequest]: {
                description: "The file hasn't finished uploading",
                schema: ReceiptUploadIncompleteErrorSchema,
            },
            ...ForbiddenResponse,
            ...NotFoundResponse,
        },
    }),
    async (req, res) => {
        const { id: userId, roles } = getAuthenticatedUser(req);
        const receipt = await Models.ReceiptSubmission.findById(req.params.id).lean();

        if (!receipt) {
            return res.status(StatusCode.ClientErrorNotFound).send(ReceiptNotFoundError);
        }
        if (receipt.userId !== userId && !roles.includes(Role.ADMIN)) {
            return res.status(StatusCode.ClientErrorForbidden).send(ReceiptForbiddenError);
        }
        if (!receipt.uploadCompletedAt) {
            return res.status(StatusCode.ClientErrorBadRequest).send(ReceiptUploadIncompleteError);
        }

        const url = await getSignedReceiptDownloadUrl(receipt.s3Key);
        return res.status(StatusCode.SuccessOK).send({ url });
    },
);

reimbursementRouter.patch(
    "/receipts/:id/review/",
    specification({
        method: "patch",
        path: "/reimbursement/receipts/{id}/review/",
        tag: Tag.REIMBURSEMENT,
        role: Role.ADMIN,
        summary: "Approves or rejects a receipt submission",
        description:
            "A rejection needs a `rejectionReason`, which the attendee can see. `reviewerNotes` are visible to the attendee too. " +
            "Setting the status back to `pending` clears the previous decision.",
        parameters: ReceiptIdParameters,
        body: ReceiptReviewRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The reviewed submission",
                schema: ReceiptSubmissionSchema,
            },
            [StatusCode.ClientErrorBadRequest]: {
                description: "The file hasn't finished uploading",
                schema: ReceiptUploadIncompleteErrorSchema,
            },
            ...NotFoundResponse,
        },
    }),
    async (req, res) => {
        const { id: reviewerId } = getAuthenticatedUser(req);
        const review = req.body;
        const receipt = await Models.ReceiptSubmission.findById(req.params.id).lean();

        if (!receipt) {
            return res.status(StatusCode.ClientErrorNotFound).send(ReceiptNotFoundError);
        }
        if (!receipt.uploadCompletedAt) {
            return res.status(StatusCode.ClientErrorBadRequest).send(ReceiptUploadIncompleteError);
        }

        const decision =
            review.status === ReceiptStatus.PENDING
                ? { reviewedAt: null, reviewedBy: null, rejectionReason: null, reviewerNotes: null }
                : {
                      reviewedAt: new Date(),
                      reviewedBy: reviewerId,
                      rejectionReason: review.status === ReceiptStatus.REJECTED ? review.rejectionReason : null,
                      reviewerNotes: review.reviewerNotes ?? null,
                  };

        const updated = await Models.ReceiptSubmission.findByIdAndUpdate(
            receipt._id,
            { status: review.status, ...decision },
            { new: true },
        ).lean();

        return res.status(StatusCode.SuccessOK).send(toReceiptSubmission(updated!));
    },
);

export default reimbursementRouter;
