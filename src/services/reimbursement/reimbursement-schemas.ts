import { modelOptions, prop } from "@typegoose/typegoose";
import { z } from "zod";
import Config from "../../common/config";
import { CreateErrorAndSchema, UserIdSchema } from "../../common/schemas";

export const RECEIPT_CONTENT_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
] as const;

export type ReceiptContentType = (typeof RECEIPT_CONTENT_TYPES)[number];

export const ReceiptContentTypeSchema = z.enum(RECEIPT_CONTENT_TYPES).openapi("ReceiptContentType", {
    example: "image/heic",
});

export enum ReceiptStatus {
    PENDING = "pending",
    APPROVED = "approved",
    REJECTED = "rejected",
}

export const ReceiptStatusSchema = z.nativeEnum(ReceiptStatus).openapi("ReceiptStatus", {
    example: ReceiptStatus.PENDING,
});

export const ReceiptIdSchema = z
    .string()
    .regex(/^[a-fA-F0-9]{24}$/)
    .openapi("ReceiptId", {
        example: "6612a3f4c2b1e5d7a8f90123",
    });

@modelOptions({ schemaOptions: { timestamps: true } })
export class ReceiptSubmission {
    @prop({ required: true, index: true })
    public userId: string;

    @prop({ required: true })
    public expenseDate: string;

    @prop({ required: true })
    public requestedAmountCents: number;

    @prop({ required: true })
    public currency: string;

    @prop({ required: true, type: String, enum: RECEIPT_CONTENT_TYPES })
    public contentType: ReceiptContentType;

    @prop({ required: false })
    public originalFileName?: string;

    @prop({ required: true })
    public s3Key: string;

    @prop({ required: false, type: Date, default: null })
    public uploadCompletedAt: Date | null;

    @prop({ required: true, type: String, enum: ReceiptStatus, default: ReceiptStatus.PENDING })
    public status: ReceiptStatus;

    @prop({ required: false, type: Date, default: null })
    public reviewedAt: Date | null;

    @prop({ required: false, type: String, default: null })
    public reviewedBy: string | null;

    @prop({ required: false, type: String, default: null })
    public rejectionReason: string | null;

    @prop({ required: false, type: String, default: null })
    public reviewerNotes: string | null;

    public createdAt: Date;
    public updatedAt: Date;
}

export const ReceiptSubmissionCreateRequestSchema = z
    .object({
        expenseDate: z.string().date(),
        // Users may request less than the receipt total (e.g. a shared team bus ticket)
        requestedAmountCents: z.number().int().positive(),
        currency: z.literal("USD").default("USD"),
        contentType: ReceiptContentTypeSchema,
        fileName: z.string().max(Config.MAX_STRING_LENGTH).optional(),
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
        status: ReceiptStatusSchema,
        reviewedAt: z.coerce.date().nullable(),
        reviewedBy: UserIdSchema.nullable(),
        rejectionReason: z.string().nullable(),
        reviewerNotes: z.string().nullable(),
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
            status: ReceiptStatus.PENDING,
            reviewedAt: null,
            reviewedBy: null,
            rejectionReason: null,
            reviewerNotes: null,
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
            url: "https://resume-bucket-dev.s3.us-east-2.amazonaws.com/",
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
        example: { url: "https://resume-bucket-dev.s3.us-east-2.amazonaws.com/receipts/github1234/abcd.heic" },
    });

const ReviewTextSchema = z.string().trim().min(1).max(Config.MAX_REVIEW_TEXT_LENGTH);

export const ReceiptReviewRequestSchema = z
    .discriminatedUnion("status", [
        z.object({
            status: z.literal(ReceiptStatus.APPROVED),
            reviewerNotes: ReviewTextSchema.optional(),
        }),
        z.object({
            status: z.literal(ReceiptStatus.REJECTED),
            // Shown to the attendee, so it's required when rejecting
            rejectionReason: ReviewTextSchema,
            reviewerNotes: ReviewTextSchema.optional(),
        }),
        // Undo a previous decision and put the receipt back in the review queue
        z.object({
            status: z.literal(ReceiptStatus.PENDING),
        }),
    ])
    .openapi("ReceiptReviewRequest", {
        example: {
            status: ReceiptStatus.REJECTED,
            rejectionReason: "The receipt total is not readable",
            reviewerNotes: "Asked them to re-upload on Discord",
        },
    });

export const [ReceiptNotFoundError, ReceiptNotFoundErrorSchema] = CreateErrorAndSchema({
    error: "NotFound",
    message: "Failed to find receipt submission",
});

export const [ReceiptForbiddenError, ReceiptForbiddenErrorSchema] = CreateErrorAndSchema({
    error: "Forbidden",
    message: "You do not have access to this receipt submission",
});

export const [ReceiptUploadIncompleteError, ReceiptUploadIncompleteErrorSchema] = CreateErrorAndSchema({
    error: "UploadIncomplete",
    message: "The receipt file has not finished uploading",
});

export const [ReceiptAlreadyReviewedError, ReceiptAlreadyReviewedErrorSchema] = CreateErrorAndSchema({
    error: "AlreadyReviewed",
    message: "This receipt submission has already been reviewed",
});

export const [ReceiptFileMissingError, ReceiptFileMissingErrorSchema] = CreateErrorAndSchema({
    error: "FileMissing",
    message: "No receipt file was found for this submission, upload it before completing",
});
