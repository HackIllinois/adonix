import { z } from "zod";
import { CreateErrorAndSchema, UserIdSchema } from "../../common/schemas";

export const RECEIPT_CONTENT_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
] as const;

export const ReceiptContentTypeSchema = z.enum(RECEIPT_CONTENT_TYPES).openapi("ReceiptContentType", {
    example: "image/heic",
});

export const ReceiptIdSchema = z.string().openapi("ReceiptId", {
    example: "6612a3f4c2b1e5d7a8f90123",
});

export const ReceiptSubmissionCreateRequestSchema = z
    .object({
        expenseDate: z.string().date(),
        // Users may request less than the receipt total (e.g. a shared team bus ticket)
        requestedAmountCents: z.number().int().positive(),
        currency: z.string().default("USD"),
        contentType: ReceiptContentTypeSchema,
        fileName: z.string().optional(),
    })
    .openapi("ReceiptSubmissionCreateRequest", {
        example: {
            expenseDate: "2026-04-12",
            requestedAmountCents: 4500,
            currency: "USD",
            contentType: "image/heic",
            fileName: "bus-ticket.heic",
        },
    });

export const ReceiptSubmissionSchema = z
    .object({
        id: ReceiptIdSchema,
        userId: UserIdSchema,
        expenseDate: z.string().date(),
        requestedAmountCents: z.number().int().positive(),
        currency: z.string(),
        contentType: ReceiptContentTypeSchema,
        originalFileName: z.string().optional(),
        s3Key: z.string(),
        uploadCompletedAt: z.coerce.date().nullable(),
        createdAt: z.coerce.date(),
        updatedAt: z.coerce.date(),
    })
    .openapi("ReceiptSubmission", {
        example: {
            id: "6612a3f4c2b1e5d7a8f90123",
            userId: "github1234",
            expenseDate: "2026-04-12",
            requestedAmountCents: 4500,
            currency: "USD",
            contentType: "image/heic",
            originalFileName: "bus-ticket.heic",
            s3Key: "github1234/6612a3f4c2b1e5d7a8f90123.heic",
            uploadCompletedAt: null,
            createdAt: new Date("2026-04-12T18:00:00.000Z"),
            updatedAt: new Date("2026-04-12T18:00:00.000Z"),
        },
    });

export const ReceiptSubmissionsSchema = z
    .object({
        submissions: z.array(ReceiptSubmissionSchema),
    })
    .openapi("ReceiptSubmissions");

export const ReceiptSubmissionCreateResponseSchema = z
    .object({
        id: ReceiptIdSchema,
        url: z.string(),
        fields: z.any(),
        s3Key: z.string(),
    })
    .openapi("ReceiptSubmissionCreateResponse", {
        example: {
            id: "6612a3f4c2b1e5d7a8f90123",
            url: "https://receipt-bucket-dev.s3.us-east-2.amazonaws.com/",
            fields: {
                success_action_status: "201",
                "Content-Type": "image/heic",
                key: "github1234/6612a3f4c2b1e5d7a8f90123.heic",
            },
            s3Key: "github1234/6612a3f4c2b1e5d7a8f90123.heic",
        },
    });

export const ReceiptDownloadURLSchema = z
    .object({
        url: z.string(),
    })
    .openapi("ReceiptDownloadURL", {
        example: { url: "https://receipt-bucket-dev.s3.us-east-2.amazonaws.com/github1234/abcd.heic" },
    });

export const [ReimbursementNotImplementedError, ReimbursementNotImplementedErrorSchema] = CreateErrorAndSchema({
    error: "NotImplemented",
    message: "Receipt reimbursement is not implemented yet",
});
