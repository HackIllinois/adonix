/* eslint-disable no-magic-numbers */
import crypto from "crypto";

const FILE_IDS = [
    "1U1UL1iNfrygNv5YsXPvlyk9ha4erMzF_",
    "1m3j0YAoJYfEYSWt6Vr3BZUnEETfdtB8K",
    "16nz6i-ScM7_3s2KqHKWQGmwLr1Tx0zbH",
    "1EDa0336F4YUOIiaNvmxnMvk2ZVfsu1Oq",
    "1Q8kWbK-RuGdBle-CDRlfWPnDjuGZuv6q",
];

export function generateChallenge2026(userId: string): { inputFileId: string } {
    const hash = crypto.createHash("sha256").update(userId).digest();
    const hash_num = hash.readUInt32BE(0);

    const index = hash_num % FILE_IDS.length;
    const inputFileId = FILE_IDS[index]!;
    return { inputFileId };
}
