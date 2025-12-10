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
        Bucket: "challenge-solution-bucket-prod",
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

export async function compareImages(uploadedImage: Buffer, referenceImage: Buffer): Promise<boolean> {
    const sharp = (await import("sharp")).default;

    try {
        // Normalize both images to same format to avoid metadata/compression differences
        const normalizeImage = async (buffer: Buffer): Promise<Buffer<ArrayBufferLike>> =>
            await sharp(buffer)
                .png() // Convert to consistent format
                .toBuffer();

        const [normalizedUploaded, normalizedReference] = await Promise.all([
            normalizeImage(uploadedImage),
            normalizeImage(referenceImage),
        ]);

        const uploadedMeta = await sharp(normalizedUploaded).metadata();
        const referenceMeta = await sharp(normalizedReference).metadata();

        // Check dimensions match
        if (uploadedMeta.width !== referenceMeta.width || uploadedMeta.height !== referenceMeta.height) {
            return false;
        }

        // Get raw pixel data
        const uploadedPixels = await sharp(normalizedUploaded).raw().toBuffer();
        const referencePixels = await sharp(normalizedReference).raw().toBuffer();

        if (uploadedPixels.length !== referencePixels.length) {
            return false;
        }

        // Calculate percentage of matching pixels (allows for minor variations)
        let matchingPixels = 0;
        const totalPixels = uploadedPixels.length;
        const PIXEL_TOLERANCE = 2; // Allow minimal color differences per channel (for encoding/rounding variations)
        const MATCH_THRESHOLD = 0.99; // Require 99% of pixels to match

        for (let i = 0; i < uploadedPixels.length; i++) {
            const diff = Math.abs(uploadedPixels[i]! - referencePixels[i]!);
            if (diff <= PIXEL_TOLERANCE) {
                matchingPixels++;
            }
        }

        const matchPercentage = matchingPixels / totalPixels;
        return matchPercentage >= MATCH_THRESHOLD;
    } catch (error) {
        console.error("Error comparing images:", error);
        return false;
    }
}
