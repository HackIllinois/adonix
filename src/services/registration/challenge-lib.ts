/* eslint-disable no-magic-numbers */
import crypto from "crypto";
import Config from "../../common/config";
import { GetObjectCommand, S3 } from "@aws-sdk/client-s3";

const FILE_IDS = [
    "1U1UL1iNfrygNv5YsXPvlyk9ha4erMzF_",
    "1m3j0YAoJYfEYSWt6Vr3BZUnEETfdtB8K",
    "16nz6i-ScM7_3s2KqHKWQGmwLr1Tx0zbH",
    "1EDa0336F4YUOIiaNvmxnMvk2ZVfsu1Oq",
    "1Q8kWbK-RuGdBle-CDRlfWPnDjuGZuv6q",
];

let s3: S3 | undefined = undefined;

function getClient(): S3 {
    s3 ??= new S3({ region: Config.S3_REGION });
    return s3;
}

export function generateChallenge2026(userId: string): { inputFileId: string } {
    const hash = crypto.createHash("sha256").update(userId).digest();
    const hash_num = hash.readUInt32BE(0);

    const index = hash_num % FILE_IDS.length;
    const inputFileId = FILE_IDS[index]!;
    return { inputFileId };
}

export async function fetchImageFromS3(fileId: string): Promise<Buffer> {
    const s3 = getClient();

    const command = new GetObjectCommand({
        Bucket: Config.CHALLENGE_BUCKET_NAME,
        Key: `${fileId}`,
    });

    const response = await s3.send(command);

    if (!response.Body) {
        throw new Error("Failed to fetch image from S3");
    }

    // Convert the stream to a buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as ReadableStream<Uint8Array>) {
        chunks.push(chunk);
    }

    return Buffer.concat(chunks);
}

export async function compareImages(uploadedImage: Buffer, baseFileId: string): Promise<boolean> {
    const sharp = (await import("sharp")).default;
    const variantIds = [`${baseFileId}v1`, `${baseFileId}v2`];

    for (const variantId of variantIds) {
        try {
            const referenceImage = await fetchImageFromS3(variantId);

            const uploadedMeta = await sharp(uploadedImage).metadata();
            const referenceMeta = await sharp(referenceImage).metadata();

            if (uploadedMeta.width !== referenceMeta.width || uploadedMeta.height !== referenceMeta.height) {
                continue; // Try next variant
            }

            // Extract raw pixels
            const uploadedPixels = await sharp(uploadedImage).raw().toBuffer();
            const referencePixels = await sharp(referenceImage).raw().toBuffer();

            if (uploadedPixels.length !== referencePixels.length) {
                continue; // Try next variant
            }

            // Compare pixel-by-pixel
            let match = true;
            for (let i = 0; i < uploadedPixels.length; i++) {
                if (uploadedPixels[i] !== referencePixels[i]) {
                    match = false;
                    break;
                }
            }

            if (match) {
                return true; // Success
            }
        } catch (err) {
            console.warn(`Failed checking variant ${variantId}:`, err);
            // Continue to next variant
        }
    }

    return false;
}
