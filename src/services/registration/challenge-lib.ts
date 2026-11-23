import crypto from "crypto";
import { readFileSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import Config from "../../common/config";
import { GetObjectCommand, S3 } from "@aws-sdk/client-s3";
import { GradeReport, parseWorld, World } from "./saloon/saloon-schemas";
import type {
    ChallengeGradeReport,
    ChallengeTierStatus,
    RegistrationChallenge,
    RegistrationChallengeStatus,
} from "./registration-schemas";

// eslint-disable-next-line no-magic-numbers
export const ALL_TIERS = [1, 2, 3] as const;
export type TierNumber = (typeof ALL_TIERS)[number];

export interface SaloonInstance {
    id: string;
    // Score our reference solver gets on this instance, graded by gradePlan. null = not calibrated yet,
    // in which case nobody can pass while this tier is live (scores are still recorded).
    referenceScore: number | null;
}

// World pools. Each id must match the world's `instance` field and its S3 key `saloon/tier<n>/<id>.json`.
// Order matters: applicants are assigned by hash index, so only ever append to these lists.

export const SALOON_INSTANCES: Record<TierNumber, SaloonInstance[]> = {
    1: [
        { id: "tier1-01", referenceScore: 1115 },
        { id: "tier1-02", referenceScore: 1015 },
        { id: "tier1-03", referenceScore: 1005 },
        { id: "tier1-04", referenceScore: 1140 },
        { id: "tier1-05", referenceScore: 1015 },
        { id: "tier1-06", referenceScore: 1025 },
        { id: "tier1-07", referenceScore: 1060 },
        { id: "tier1-08", referenceScore: 1010 },
    ],
    2: [
        { id: "tier2-01", referenceScore: 5095 },
        { id: "tier2-02", referenceScore: 5400 },
        { id: "tier2-03", referenceScore: 4980 },
        { id: "tier2-04", referenceScore: 5070 },
        { id: "tier2-05", referenceScore: 5180 },
        { id: "tier2-06", referenceScore: 5130 },
        { id: "tier2-07", referenceScore: 5240 },
        { id: "tier2-08", referenceScore: 5375 },
    ],
    3: [
        { id: "tier3-01", referenceScore: 8115 },
        { id: "tier3-02", referenceScore: 8965 },
        { id: "tier3-03", referenceScore: 9120 },
        { id: "tier3-04", referenceScore: 8765 },
        { id: "tier3-05", referenceScore: 9030 },
        { id: "tier3-06", referenceScore: 8705 },
        { id: "tier3-07", referenceScore: 8925 },
        { id: "tier3-08", referenceScore: 8535 },
    ],
};

/** Tiers applicants can play right now (Config.PRO_CHALLENGE_TIERS). */
export function liveTiers(): TierNumber[] {
    return Config.PRO_CHALLENGE_TIERS;
}

export function isLiveTier(tier: number): tier is TierNumber {
    return (liveTiers() as number[]).includes(tier);
}

let s3: S3 | undefined = undefined;

function getClient(): S3 {
    s3 ??= new S3({ region: Config.S3_REGION });
    return s3;
}

/**
 * Deterministically picks a world for a user and tier, so refreshing never changes it.
 * Tier 1 hashes the user id alone, as it always has, so existing assignments don't move.
 */
export function assignInstance(userId: string, tier: TierNumber = 1): string {
    const seed = tier === 1 ? userId : `${userId}:tier${tier}`;
    const hash = crypto.createHash("sha256").update(seed).digest();
    const instances = SALOON_INSTANCES[tier];
    return instances[hash.readUInt32BE(0) % instances.length]!.id;
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
    for (const tier of ALL_TIERS) {
        const instance = SALOON_INSTANCES[tier].find((i) => i.id === instanceId);
        if (instance) {
            return instance.referenceScore;
        }
    }
    return null;
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

/** S3 key for a world: tier1-03 -> saloon/tier1/tier1-03.json */
export function worldKey(instanceId: string): string {
    const tier = /^tier(\d)-/.exec(instanceId)?.[1] ?? "1";
    return `saloon/tier${tier}/${instanceId}.json`;
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
        totalOrders: report.totalOrders,
        completed: report.completed,
        onTime: report.onTime,
        lateMinutes: report.lateMinutes,
        travelMinutes: report.travelMinutes,
        errors: report.routeErrors.map(({ driver, index, message }) => ({ driver, index, message })),
        coinsEarned: report.coinsEarned ?? 0,
        coinsSpent: report.coinsSpent ?? 0,
        powerupErrors: (report.powerupErrors ?? []).map(({ index, message }) => ({ index, message })),
    };
}

/** One tier's progress, wherever it's stored. */
export interface TierProgress {
    instanceId: string;
    attempts: number;
    bestScore: number;
    bestTravelMinutes?: number;
    lastReport?: ChallengeGradeReport;
    lastSubmittedAt?: number;
}

/** Tier 1 lives at the top of the record (the v1 layout), Tiers 2 and 3 in `tier2` / `tier3`. */
export function tierProgress(challenge: RegistrationChallenge, tier: TierNumber): TierProgress | null {
    if (tier === 1) {
        return {
            instanceId: challenge.instanceId,
            attempts: challenge.attempts,
            bestScore: challenge.bestScore ?? 0,
            bestTravelMinutes: challenge.bestTravelMinutes,
            lastReport: challenge.lastReport,
            lastSubmittedAt: challenge.lastSubmittedAt,
        };
    }
    const progress = tier === 2 ? challenge.tier2 : challenge.tier3;
    if (!progress) {
        return null;
    }
    // Copied field by field: a stored subdocument keeps its fields behind getters, so spreading it loses them
    return {
        instanceId: progress.instanceId,
        attempts: progress.attempts ?? 0,
        bestScore: progress.bestScore ?? 0,
        bestTravelMinutes: progress.bestTravelMinutes,
        lastReport: progress.lastReport,
        lastSubmittedAt: progress.lastSubmittedAt,
    };
}

/** Mongo path of a tier's field, e.g. ("bestScore", 1) -> "bestScore", ("bestScore", 2) -> "tier2.bestScore". */
export function tierPath(tier: TierNumber, field: keyof TierProgress): string {
    return tier === 1 ? field : `tier${tier}.${field}`;
}

/** Epoch ms when the next upload is allowed, or null if it's allowed now. */
export function nextSubmitAt(lastSubmittedAt: number | undefined, now = Date.now()): number | null {
    if (lastSubmittedAt === undefined) {
        return null;
    }
    const next = lastSubmittedAt + Config.CHALLENGE_SUBMIT_COOLDOWN_SECONDS * Config.MILLISECONDS_PER_SECOND;
    return next > now ? next : null;
}

export interface OverallScore {
    // Average of best / reference over the live tiers; null if any live tier isn't calibrated
    score: number | null;
    // Walking minutes of the best plans across live tiers
    travelMinutes: number;
    // normalizedScore per live tier
    tierScores: (number | null)[];
}

export function overallScore(challenge: RegistrationChallenge): OverallScore {
    let total = 0;
    let travelMinutes = 0;
    let calibrated = true;
    const tierScores: (number | null)[] = [];
    for (const tier of liveTiers()) {
        const progress = tierProgress(challenge, tier);
        const instanceId = progress?.instanceId ?? assignInstance(challenge.userId, tier);
        const normalized = normalizeScore(instanceId, progress?.bestScore ?? 0);
        tierScores.push(normalized);
        if (normalized === null) {
            calibrated = false;
        } else {
            total += normalized;
        }
        travelMinutes += progress?.bestTravelMinutes ?? 0;
    }
    return { score: calibrated ? total / liveTiers().length : null, travelMinutes, tierScores };
}

function tierStatus(challenge: RegistrationChallenge, tier: TierNumber): ChallengeTierStatus {
    const progress = tierProgress(challenge, tier);
    const instanceId = progress?.instanceId ?? assignInstance(challenge.userId, tier);
    const bestScore = progress?.bestScore ?? 0;
    return {
        tier,
        instanceId,
        attempts: progress?.attempts ?? 0,
        bestScore,
        normalizedScore: normalizeScore(instanceId, bestScore),
        lastReport: progress?.lastReport ? fromStoredReport(progress.lastReport) : null,
        nextSubmitAt: nextSubmitAt(progress?.lastSubmittedAt),
    };
}

/** What the applicant sees about their challenge. The top-level fields are Tier 1, as in the v1 API. */
export function toChallengeStatus(challenge: RegistrationChallenge): RegistrationChallengeStatus {
    const tier1 = tierStatus(challenge, 1);
    return {
        instanceId: tier1.instanceId,
        attempts: tier1.attempts,
        complete: challenge.complete,
        bestScore: tier1.bestScore,
        normalizedScore: tier1.normalizedScore,
        passRatio: Config.PRO_CHALLENGE_PASS_RATIO,
        lastReport: tier1.lastReport,
        overallScore: overallScore(challenge).score,
        tiers: liveTiers().map((tier) => tierStatus(challenge, tier)),
    };
}
