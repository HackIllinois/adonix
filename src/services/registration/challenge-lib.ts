/* eslint-disable no-magic-numbers */
import { RegistrationChallenge } from "./registration-schemas";
import { GetObjectCommand, S3 } from "@aws-sdk/client-s3";
import Config from "../../common/config";
import { createPresignedPost, PresignedPost } from "@aws-sdk/s3-presigned-post";
import sharp from "sharp";

let s3: S3 | undefined = undefined;

function getClient(): S3 {
    s3 ??= new S3({ region: Config.S3_REGION });
    return s3;
}

/**
 * Creates a presigned POST URL for uploading a challenge solution image
 */
export function createSignedChallengeSolutionPostUrl(userId: string): Promise<PresignedPost> {
    const s3 = getClient();

    return createPresignedPost(s3, {
        Bucket: Config.S3_CHALLENGE_BUCKET_NAME,
        Key: `solution_${userId}.png`,
        Conditions: [
            ["content-length-range", 0, Config.MAX_CHALLENGE_IMAGE_SIZE_BYTES], // e.g., 10 MB max
        ],
        Fields: {
            success_action_status: "201",
            "Content-Type": "image/png",
        },
        Expires: Config.CHALLENGE_URL_EXPIRY_SECONDS,
    });
}

/**
 * Fetches an image from S3
 */
async function fetchImageFromS3(bucketName: string, key: string): Promise<Buffer> {
    const s3 = getClient();
    const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
    });

    const response = await s3.send(command);
    const stream = response.Body;

    if (!stream) {
        throw new Error("No data returned from S3");
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

/**
 * Compares two images pixel by pixel
 * Returns true if images are identical
 */
export async function compareChallengeSolution(userId: string, inputFileId: string): Promise<boolean> {
    try {
        // Fetch the uploaded solution
        const uploadedImage = await fetchImageFromS3(Config.S3_CHALLENGE_BUCKET_NAME, `solution_${userId}.png`);

        // Fetch the reference solution (stored as inputFileId.png)
        const referenceImage = await fetchImageFromS3(Config.S3_CHALLENGE_BUCKET_NAME, `${inputFileId}.png`);

        // Get image metadata
        const uploadedMeta = await sharp(uploadedImage).metadata();
        const referenceMeta = await sharp(referenceImage).metadata();

        // Check dimensions match
        if (uploadedMeta.width !== referenceMeta.width || uploadedMeta.height !== referenceMeta.height) {
            return false;
        }

        // Convert both to raw pixel data
        const uploadedPixels = await sharp(uploadedImage).raw().toBuffer();
        const referencePixels = await sharp(referenceImage).raw().toBuffer();

        // Compare pixel by pixel
        if (uploadedPixels.length !== referencePixels.length) {
            return false;
        }

        for (let i = 0; i < uploadedPixels.length; i++) {
            if (uploadedPixels[i] !== referencePixels[i]) {
                return false;
            }
        }

        return true;
    } catch (error) {
        console.error("Error comparing images:", error);
        return false;
    }
}

const PEOPLE = [
    "Zeus",
    "Poseidon",
    "Hades",
    "Ares",
    "Hermes",
    "Apollo",
    "Artemis",
    "Athena",
    "Aphrodite",
    "Hephaestus",
    "Demeter",
    "Dionysus",
    "Hera",
    "Eros",
    "Helios",
    "Selene",
    "Pan",
    "Heracles",
    "Prometheus",
    "Hecate",
    "Persephone",
    "Asclepius",
    "Aeolus",
    "Iris",
    "Nike",
    "Nemesis",
    "Hypnos",
    "Thanatos",
    "Chronos",
    "Rhea",
    "Cronus",
    "Gaia",
    "Uranus",
    "Oceanus",
    "Tethys",
    "Hyperion",
    "Theia",
    "Coeus",
    "Phoebe",
    "Iapetus",
    "Themis",
    "Mnemosyne",
    "Pontus",
    "Tartarus",
    "Nyx",
    "Erebus",
    "Harmonia",
    "Eris",
    "Tyche",
    "Phobos",
    "Deimos",
];

// Generates a challenge
// NOTE: We generate BACKWARDS from the solution in order to not reveal the solution to solve the problem
// So, if you're an attendee trying to solve the challenge by looking at the source code, great attempt but it won't work
export function generateChallenge(): Pick<RegistrationChallenge, "alliances" | "people" | "solution"> {
    // Random solution [-100_000_000, 100_000_000]
    const solution = Math.floor(Math.random() * 100_000_000) + 50_000_000;

    // Divide people into random groups
    const remainingPeople = [...PEOPLE];
    remainingPeople.sort(() => Math.random() - 0.5); // Randomly sort
    const groups = [];

    // One quarter to half group (random)
    groups.push(
        remainingPeople.splice(
            0,
            Math.floor(remainingPeople.length / 4) + Math.floor(Math.random() * (remainingPeople.length / 4)),
        ),
    );
    // A group of 5
    groups.push(remainingPeople.splice(0, 5));
    // Half of remaining into groups of 3
    for (let i = 0; i < Math.floor(remainingPeople.length / 3); i += 3) {
        groups.push(remainingPeople.splice(0, 3));
    }
    // Half of remaining into groups of 2
    for (let i = 0; i < Math.floor(remainingPeople.length / 2); i += 2) {
        groups.push(remainingPeople.splice(0, 2));
    }
    // Rest into groups of 1
    for (let i = 0; i < remainingPeople.length; i++) {
        groups.push(remainingPeople.splice(0, 1));
    }

    // Figure out weights for each person
    const people: Map<string, number> = new Map();
    const solutionGroup = groups[Math.floor(Math.random() * groups.length)];
    for (const group of groups) {
        // The goal sum of the group is the solution if it's the solution group, or some random about lower than that
        const groupSum = group === solutionGroup ? solution : solution - Math.floor(Math.random() * 50_000_000);
        // Weights start off evenly dividing group sum
        const groupWeights = group.map(() => Math.floor(groupSum / group.length));
        for (let n = 0; n < 10; n++) {
            for (let i = 0; i < groupWeights.length; i++) {
                // Apply offsets, where we both add and subtract the same value between two nodes in the group
                // This ensures the sum stays the same, but prevents all the values being just groupSum / length
                // Also makes it non-reversible
                const j = Math.floor(Math.random() * group.length);
                const offset = Math.floor(Math.random() * 50_000_000);
                groupWeights[i]! += offset;
                groupWeights[j]! -= offset;
            }
        }

        // Since we floor what each person gets, we'll be off by a little bit sometimes
        // This corrects that
        groupWeights[0]! -= groupWeights.reduce((acc, curr) => acc + curr) - groupSum;

        // Update each person in the group
        for (let i = 0; i < group.length; i++) {
            people.set(group[i]!, groupWeights[i]!);
        }
    }

    // Make edges
    const alliances: [string, string][] = [];

    const addAlliance = (a: string, b: string): void => {
        // Check for duplicates
        for (const alliance of alliances) {
            if ((alliance[0] == a && alliance[1] == b) || (alliance[1] == a && alliance[0] == b)) {
                return;
            }
        }

        alliances.push([a, b]);
    };

    for (const group of groups) {
        // If len > 1, add edges that at least ensure connectivity
        // For 2 and 3 this is a straight line, for the rest it's spread out
        if (group.length == 1) {
            continue;
        } else if (group.length == 2) {
            addAlliance(group[0]!, group[1]!);
        } else if (group.length == 3) {
            addAlliance(group[0]!, group[1]!);
            addAlliance(group[1]!, group[2]!);
        } else if (group.length == 4) {
            addAlliance(group[0]!, group[3]!);
            addAlliance(group[0]!, group[1]!);
            addAlliance(group[1]!, group[2]!);
        } else if (group.length == 5) {
            addAlliance(group[0]!, group[4]!);
            addAlliance(group[0]!, group[1]!);
            addAlliance(group[1]!, group[2]!);
            addAlliance(group[3]!, group[4]!);
        } else {
            for (let i = 0; i < group.length; i += 3) {
                addAlliance(group[i]!, group[(i + 3) % group.length]!);
                addAlliance(group[i]!, group[(i + 1) % group.length]!);
                addAlliance(group[(i + 2) % group.length]!, group[(i + 3) % group.length]!);
            }
        }

        // Add random edges
        for (const person1 of group) {
            for (const person2 of group) {
                if (person1 == person2 || Math.random() < 0.1) {
                    continue;
                }
                addAlliance(person1, person2);
            }
        }
    }

    return { people, alliances, solution };
}


