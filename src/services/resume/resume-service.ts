import { GetObjectCommand, S3 } from "@aws-sdk/client-s3";
import Config from "../../common/config";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createPresignedPost, PresignedPost } from "@aws-sdk/s3-presigned-post";

let s3: S3 | undefined = undefined;

function getClient(): S3 {
    s3 ??= new S3({ region: Config.S3_REGION });
    return s3;
}

export function getSignedResumeDownloadUrl(userId: string): Promise<string> {
    const s3 = getClient();

    const command = new GetObjectCommand({
        Bucket: Config.S3_RESUME_BUCKET_NAME,
        Key: `${userId}.pdf`,
    });

    return getSignedUrl(s3, command, {
        expiresIn: Config.RESUME_URL_EXPIRY_SECONDS,
    });
}

export async function getSignedResumeDownloadUrlList(userIds: string[]): Promise<string[]> {
    const results = await Promise.all(userIds.map((userId) => getSignedResumeDownloadUrl(userId).catch(() => null)));
    const list = results.filter((url): url is string => url !== null);

    return list;
}

export function createSignedResumePostUrl(userId: string): Promise<PresignedPost> {
    const s3 = getClient();

    return createPresignedPost(s3, {
        Bucket: Config.S3_RESUME_BUCKET_NAME,
        Key: `${userId}.pdf`,
        Conditions: [
            ["content-length-range", 0, Config.MAX_RESUME_SIZE_BYTES], // 5 MB max
        ],
        Fields: {
            success_action_status: "201",
            "Content-Type": "application/pdf",
        },
        Expires: Config.RESUME_URL_EXPIRY_SECONDS,
    });
}
