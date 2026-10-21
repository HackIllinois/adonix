import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, S3 } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createPresignedPost, PresignedPost } from "@aws-sdk/s3-presigned-post";
import { Types } from "mongoose";
import { z } from "zod";
import Config from "../../common/config";
import { ReceiptContentType, ReceiptSubmission, ReceiptSubmissionSchema } from "./reimbursement-schemas";

let s3: S3 | undefined = undefined;

function getClient(): S3 {
    s3 ??= new S3({ region: Config.S3_REGION });
    return s3;
}

const EXTENSIONS: Record<ReceiptContentType, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
};

export function receiptS3Key(userId: string, receiptId: string, contentType: ReceiptContentType): string {
    return `${userId}/${receiptId}.${EXTENSIONS[contentType]}`;
}

export function createSignedReceiptPostUrl(s3Key: string, contentType: ReceiptContentType): Promise<PresignedPost> {
    return createPresignedPost(getClient(), {
        Bucket: Config.S3_RECEIPT_BUCKET_NAME,
        Key: s3Key,
        Conditions: [
            ["content-length-range", 0, Config.MAX_RECEIPT_SIZE_BYTES],
            ["eq", "$Content-Type", contentType],
        ],
        Fields: {
            success_action_status: "201",
            "Content-Type": contentType,
        },
        Expires: Config.RECEIPT_URL_EXPIRY_SECONDS,
    });
}

export function getSignedReceiptDownloadUrl(s3Key: string): Promise<string> {
    const command = new GetObjectCommand({
        Bucket: Config.S3_RECEIPT_BUCKET_NAME,
        Key: s3Key,
    });

    return getSignedUrl(getClient(), command, {
        expiresIn: Config.RECEIPT_URL_EXPIRY_SECONDS,
    });
}

export async function receiptFileExists(s3Key: string): Promise<boolean> {
    try {
        await getClient().send(new HeadObjectCommand({ Bucket: Config.S3_RECEIPT_BUCKET_NAME, Key: s3Key }));
        return true;
    } catch {
        return false;
    }
}

export async function deleteReceiptFile(s3Key: string): Promise<void> {
    await getClient().send(new DeleteObjectCommand({ Bucket: Config.S3_RECEIPT_BUCKET_NAME, Key: s3Key }));
}

// reviewerNotes are internal to staff, so they're only included for admins
export function toReceiptSubmission(
    receipt: ReceiptSubmission & { _id: Types.ObjectId | string },
    isAdmin: boolean,
): z.infer<typeof ReceiptSubmissionSchema> {
    return {
        id: receipt._id.toString(),
        userId: receipt.userId,
        expenseDate: receipt.expenseDate,
        requestedAmountCents: receipt.requestedAmountCents,
        currency: receipt.currency,
        contentType: receipt.contentType,
        originalFileName: receipt.originalFileName,
        s3Key: receipt.s3Key,
        uploadCompletedAt: receipt.uploadCompletedAt ?? null,
        status: receipt.status,
        reviewedAt: receipt.reviewedAt ?? null,
        reviewedBy: receipt.reviewedBy ?? null,
        rejectionReason: receipt.rejectionReason ?? null,
        reviewerNotes: isAdmin ? receipt.reviewerNotes ?? null : null,
        createdAt: receipt.createdAt,
        updatedAt: receipt.updatedAt,
    };
}
