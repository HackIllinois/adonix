import crypto from "crypto";
import { readFileSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import Config from "../../common/config";
import { GetObjectCommand, S3 } from "@aws-sdk/client-s3";
import { GradeReport, parseWorld, World } from "./saloon/saloon-schemas";
import type { ChallengeGradeReport, RegistrationChallenge, RegistrationChallengeStatus } from "./registration-schemas";

export interface SaloonInstance {
    id: string;
    // Score our reference solver gets on this instance, graded by gradePlan. null = not calibrated yet,
    // in which case nobody can pass on this instance (scores are still recorded).
    referenceScore: number | null;
}

// Tier 1 pool. Each id must match the world's `instance` field and its S3 key `saloon/tier1/<id>.json`.
// Order matters: applicants are assigned by hash index, so only ever append to this list.
export const SALOON_INSTANCES: SaloonInstance[] = [
    { id: "tier1-01", referenceScore: null },
    { id: "tier1-02", referenceScore: null },
    { id: "tier1-03", referenceScore: null },
    { id: "tier1-04", referenceScore: null },
    { id: "tier1-05", referenceScore: null },
    { id: "tier1-06", referenceScore: null },
    { id: "tier1-07", referenceScore: null },
    { id: "tier1-08", referenceScore: null },
];

let s3: S3 | undefined = undefined;

function getClient(): S3 {
    s3 ??= new S3({ region: Config.S3_REGION });
    return s3;
}

/** Deterministically picks an instance for a user, so refreshing never changes their world. */
export function assignInstance(userId: string): string {
    const hash = crypto.createHash("sha256").update(userId).digest();
    const index = hash.readUInt32BE(0) % SALOON_INSTANCES.length;
    return SALOON_INSTANCES[index]!.id;
}

// Dev only: <CHALLENGE_LOCAL_WORLDS_DIR>/reference-scores.json ({ "tier1-01": 940, ... }), read once
let localReferenceScores: Record<string, number> | null | undefined = undefined;

function getLocalReferenceScore(instanceId: string): number | undefined {
    const dir = Config.CHALLENGE_LOCAL_WORLDS_DIR;
    if (!dir) {
        return undefined;
    }
    if (localReferenceScores === undefined) {
        try {
            localReferenceScores = JSON.parse(readFileSync(path.join(dir, "reference-scores.json"), "utf8"));
        } catch {
            localReferenceScores = null;
        }
    }
    return localReferenceScores?.[instanceId];
}

export function getReferenceScore(instanceId: string): number | null {
    // Local dev overrides, most specific first. Both are always undefined in production.
    const local = getLocalReferenceScore(instanceId) ?? Config.CHALLENGE_LOCAL_REFERENCE_SCORE;
    if (local) {
        return local;
    }
    return SALOON_INSTANCES.find((instance) => instance.id === instanceId)?.referenceScore ?? null;
}

/** Score divided by the reference score, or null if the instance isn't calibrated. */
export function normalizeScore(instanceId: string, score: number): number | null {
    const reference = getReferenceScore(instanceId);
    if (!reference || reference <= 0) {
        return null;
    }
    return score / reference;
}

export async function fetchObjectFromS3(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
        Bucket: Config.CHALLENGE_BUCKET_NAME,
        Key: key,
    });

    const response = await getClient().send(command);

    if (!response.Body) {
        throw new Error(`Failed to fetch ${key} from S3`);
    }

    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as ReadableStream<Uint8Array>) {
        chunks.push(chunk);
    }

    return Buffer.concat(chunks);
}

export function worldKey(instanceId: string): string {
    return `saloon/tier1/${instanceId}.json`;
}

export interface WorldFile {
    // The file exactly as published, served to applicants (may include extra fields like coordinates)
    text: string;
    // Parsed and checked copy used for grading
    world: World;
}

// Worlds never change once published, so cache them for the life of the process
const worldCache = new Map<string, Promise<WorldFile>>();

export async function getWorldFile(instanceId: string): Promise<WorldFile> {
    let file = worldCache.get(instanceId);
    if (!file) {
        // instanceId always comes from SALOON_INSTANCES, never from the request, so it's safe in a path
        const localDir = Config.CHALLENGE_LOCAL_WORLDS_DIR;
        const read = localDir ? readFile(path.join(localDir, `${instanceId}.json`)) : fetchObjectFromS3(worldKey(instanceId));
        file = read.then((buffer) => {
            const text = buffer.toString("utf8");
            const world = parseWorld(JSON.parse(text));
            if (world.instance !== instanceId) {
                throw new Error(`World ${worldKey(instanceId)} has instance "${world.instance}", expected "${instanceId}"`);
            }
            return { text, world };
        });
        worldCache.set(instanceId, file);
        // Don't cache failures, so a transient S3 error can be retried
        void file.catch(() => {
            worldCache.delete(instanceId);
        });
    }
    return file;
}

/** Grade report as stored in mongo (`errors` is a reserved mongoose path, so it's saved as `routeErrors`). */
export function toStoredReport(report: GradeReport): ChallengeGradeReport {
    const { errors, ...rest } = report;
    return { ...rest, routeErrors: errors };
}

function fromStoredReport(report: ChallengeGradeReport): GradeReport {
    return {
        instance: report.instance,
        score: report.score,
        totalContracts: report.totalContracts,
        completed: report.completed,
        onTime: report.onTime,
        lateMinutes: report.lateMinutes,
        travelMinutes: report.travelMinutes,
        errors: report.routeErrors.map(({ mercenary, index, message }) => ({ mercenary, index, message })),
    };
}

/** What the applicant sees about their challenge. */
export function toChallengeStatus(challenge: RegistrationChallenge): RegistrationChallengeStatus {
    const bestScore = challenge.bestScore ?? 0;
    return {
        instanceId: challenge.instanceId,
        attempts: challenge.attempts,
        complete: challenge.complete,
        bestScore,
        normalizedScore: normalizeScore(challenge.instanceId, bestScore),
        passRatio: Config.PRO_CHALLENGE_PASS_RATIO,
        lastReport: challenge.lastReport ? fromStoredReport(challenge.lastReport) : null,
    };
}
