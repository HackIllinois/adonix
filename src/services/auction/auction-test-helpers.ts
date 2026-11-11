/* eslint-disable no-magic-numbers */
import { expect } from "@jest/globals";
import Models from "../../common/models";
import { AttendeeProfile } from "../profile/profile-schemas";
import { AuctionItem, AuctionStatus } from "./auction-schemas";
import { runAuctionTimer } from "./auction-timer";

export const BASE_MS = new Date("2026-03-01T18:00:00Z").getTime();
export const HOUR_MS = 60 * 60 * 1000;

export function makeClock(startMs = BASE_MS): { clock: () => Date; advance: (ms: number) => void; set: (ms: number) => void } {
    let nowMs = startMs;
    return {
        clock: (): Date => new Date(nowMs),
        advance: (ms: number): void => {
            nowMs += ms;
        },
        set: (ms: number): void => {
            nowMs = ms;
        },
    };
}

export async function seedProfile(userId: string, points: number, overrides: Partial<AttendeeProfile> = {}): Promise<void> {
    await Models.AttendeeProfile.create({
        userId,
        displayName: `name-of-${userId}`,
        avatarUrl: "https://example.com/a.png",
        discordTag: "tag",
        points,
        pointsAccumulated: 500,
        tier: 2,
        foodWave: 1,
        dietaryRestrictions: [],
        shirtSize: "M",
        team: "Team 1",
        teamBadge: "https://example.com/b.png",
        ...overrides,
    } satisfies AttendeeProfile);
}

// A profile made before auctions existed: no auctionHolds or auctionWins fields at all
export async function seedOldProfile(userId: string, points: number): Promise<void> {
    await seedProfile(userId, points);
    await Models.AttendeeProfile.collection.updateOne({ userId }, { $unset: { auctionHolds: "", auctionWins: "" } });
}

export async function seedItem(overrides: Partial<AuctionItem> = {}): Promise<AuctionItem> {
    const closeTime = overrides.closeTime ?? new Date(BASE_MS + HOUR_MS);
    const item = await Models.AuctionItem.create({
        itemId: "hoodie",
        name: "Hoodie",
        description: "A signed hoodie",
        imageURL: "https://example.com/hoodie.png",
        startPrice: 50,
        step: 5,
        closeTime,
        originalCloseTime: closeTime,
        status: AuctionStatus.OPEN,
        ...overrides,
    });
    return item.toObject();
}

export async function getProfile(userId: string): Promise<AttendeeProfile> {
    const profile = await Models.AttendeeProfile.findOne({ userId }).lean();
    if (!profile) {
        throw new Error(`no profile ${userId}`);
    }
    return profile;
}

export async function getItem(itemId = "hoodie"): Promise<AuctionItem> {
    const item = await Models.AuctionItem.findOne({ itemId }).lean();
    if (!item) {
        throw new Error(`no item ${itemId}`);
    }
    return item;
}

// points + held + spent, over every profile. Must never change.
export async function totalPoints(): Promise<number> {
    const profiles = await Models.AttendeeProfile.find().lean();
    let total = 0;
    for (const profile of profiles) {
        total += profile.points;
        total += (profile.auctionHolds ?? []).reduce((sum, hold) => sum + hold.amount, 0);
        total += (profile.auctionWins ?? []).reduce((sum, win) => sum + win.amount, 0);
    }
    return total;
}

let reviewExpected = new Set<string>();

// A test that means to leave an item flagged for staff review says so here
export function expectReview(itemId: string): void {
    reviewExpected = new Set([...reviewExpected, itemId]);
}

/*
 * Runs after each test. Runs the timer far in the future, two times, so every item closes and
 * every repair is done. Then checks:
 * - no points were made or lost
 * - no points are still held
 * - only the items the test named with expectReview are flagged for review
 * - every closed item with a high bid has a paid winner (or is flagged for review)
 */
export async function expectFinalInvariants(startingTotal: number): Promise<void> {
    const expected = [...reviewExpected].sort();
    reviewExpected = new Set();
    const farFuture = (): Date => new Date(Math.max(Date.now(), BASE_MS) + 365 * 24 * HOUR_MS);
    await runAuctionTimer(farFuture);
    await runAuctionTimer(farFuture);

    expect(await totalPoints()).toBe(startingTotal);

    const profiles = await Models.AttendeeProfile.find().lean();
    for (const profile of profiles) {
        expect({ userId: profile.userId, holds: profile.auctionHolds ?? [] }).toEqual({ userId: profile.userId, holds: [] });
    }

    const items = await Models.AuctionItem.find().lean();
    const flagged = items.filter((item) => item.needsReview).map((item) => item.itemId);
    expect({ flaggedForReview: flagged.sort() }).toEqual({ flaggedForReview: expected });
    for (const item of items) {
        expect(item.status).not.toBe(AuctionStatus.OPEN);
        if (item.status !== AuctionStatus.CLOSED || !item.highBid || item.needsReview) {
            continue;
        }
        const winner = profiles.find((profile) => profile.userId === item.highBid!.userId);
        const win = winner?.auctionWins?.find((entry) => entry.itemId === item.itemId);
        expect({ itemId: item.itemId, paid: win?.amount }).toEqual({ itemId: item.itemId, paid: item.highBid.amount });
    }
}

// Pushes are sent in the background after a bid returns. Waits up to 1 s for the first one.
export async function waitForPushes(spy: { mock: { calls: unknown[] } }): Promise<void> {
    for (let waited = 0; spy.mock.calls.length === 0 && waited < 1000; waited += 10) {
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
}
