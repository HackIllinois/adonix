import Config from "../../common/config";
import Models from "../../common/models";
import RuntimeConfig from "../../common/runtimeConfig";
import { AuctionHold, AuctionItem, AuctionStatus } from "./auction-schemas";
import {
    Clock,
    STALE_HOLD_MS,
    claimAndSendWinnerPush,
    findHold,
    isWinnerPaid,
    markClosed,
    releaseHold,
    replaceHold,
    settleWinner,
} from "./auction-lib";

const LOG = "[auction]";
const TIMER_INTERVAL_MS = 30_000;
// Longer than the 30 s tick, so the next tick skips while a slow run is still going
const MAX_RUN_MS = 300_000;

export interface TimerSummary {
    closed: number;
    settled: number;
    released: number;
    repaired: number;
    review: number;
    pushes: number;
}

type RepairOutcome = "ok" | "changed" | "skipped" | "released" | "repaired" | "settled" | "review";

/*
 * Makes one old hold obey the hold rule again (see the table in the plan, "Timer" step 2).
 * Before it repairs a hold on an OPEN item, it raises the item's version (the "fence"), so a
 * stalled bid that read the old version can never write the item afterwards.
 */
async function repairHold(userId: string, hold: AuctionHold, now: Date): Promise<RepairOutcome> {
    const item = await Models.AuctionItem.findOne({ itemId: hold.itemId }).lean();
    if (!item) {
        console.error(`${LOG} timer: hold on a missing item, fix by hand user=${userId} item=${hold.itemId} bid=${hold.bidId}`);
        return "review";
    }
    // Read the hold again after the item, so we act on the newest hold
    const profile = await Models.AttendeeProfile.findOne({ userId }).lean();
    const current = findHold(profile?.auctionHolds, hold.itemId);
    if (!current || current.bidId !== hold.bidId) {
        return "changed";
    }

    const highBid = item.highBid;
    switch (item.status) {
        case AuctionStatus.OPEN: {
            if (highBid?.bidId === current.bidId) {
                return "ok";
            }
            const fence = await Models.AuctionItem.updateOne(
                { itemId: item.itemId, version: item.version, status: AuctionStatus.OPEN },
                { $inc: { version: 1 } },
            );
            if (fence.modifiedCount !== 1) {
                return "skipped";
            }
            if (highBid && highBid.userId === userId) {
                // A self-raise stopped before its item write: put the hold back to the leading bid
                const done = await replaceHold(userId, item.itemId, current, highBid, now);
                return done ? "repaired" : "skipped";
            }
            return (await releaseHold(userId, item.itemId, current)) ? "released" : "skipped";
        }
        case AuctionStatus.CLOSED: {
            if (highBid && highBid.userId === userId) {
                const outcome = await settleWinner(item.itemId, now);
                return outcome === "review" ? "review" : "settled";
            }
            return (await releaseHold(userId, item.itemId, current)) ? "released" : "skipped";
        }
        case AuctionStatus.CANCELLED:
        default:
            return (await releaseHold(userId, item.itemId, current)) ? "released" : "skipped";
    }
}

export async function runAuctionTimer(clock: Clock): Promise<TimerSummary> {
    const now = clock();
    const cutoff = new Date(now.getTime() - STALE_HOLD_MS);
    const summary: TimerSummary = { closed: 0, settled: 0, released: 0, repaired: 0, review: 0, pushes: 0 };

    // 1. Close due items
    const due = await Models.AuctionItem.find({ status: AuctionStatus.OPEN, closeTime: { $lte: now } }).lean();
    for (const item of due) {
        try {
            const closed = await markClosed(item, now);
            if (!closed) {
                continue;
            }
            summary.closed++;
            const outcome = await settleWinner(closed.itemId, now);
            console.log(`${LOG} timer: closed item=${closed.itemId} outcome=${outcome}`);
            if (outcome === "settled") {
                summary.settled++;
            } else if (outcome === "review") {
                summary.review++;
            }
            if ((outcome === "settled" || outcome === "already") && (await claimAndSendWinnerPush(closed))) {
                summary.pushes++;
            }
        } catch (error) {
            // One bad item must not stop the rest; the next run tries it again
            console.error(`${LOG} timer: close failed item=${item.itemId}`, error);
        }
    }

    // 2. Make the hold rule true again for old holds
    const profiles = await Models.AttendeeProfile.find({ auctionHolds: { $elemMatch: { at: { $lt: cutoff } } } }).lean();
    for (const profile of profiles) {
        for (const hold of profile.auctionHolds ?? []) {
            if (hold.at.getTime() >= cutoff.getTime()) {
                continue;
            }
            let outcome: RepairOutcome;
            try {
                outcome = await repairHold(profile.userId, hold, now);
            } catch (error) {
                console.error(`${LOG} timer: repair failed user=${profile.userId} item=${hold.itemId}`, error);
                continue;
            }
            if (outcome !== "ok" && outcome !== "changed") {
                console.log(`${LOG} timer: hold user=${profile.userId} item=${hold.itemId} bid=${hold.bidId} outcome=${outcome}`);
            }
            if (outcome === "released" || outcome === "repaired" || outcome === "settled" || outcome === "review") {
                summary[outcome]++;
            }
        }
    }

    // 3. Leader check: every leader of an open item must hold the points
    const leading = await Models.AuctionItem.find({
        status: AuctionStatus.OPEN,
        needsReview: false,
        "highBid.time": { $lt: cutoff },
    }).lean();
    for (const item of leading) {
        try {
            await checkLeader(item, summary);
        } catch (error) {
            console.error(`${LOG} timer: leader check failed item=${item.itemId}`, error);
        }
    }

    // 4. Send "won" pushes that a stopped run did not send
    const unpushed = await Models.AuctionItem.find({
        status: AuctionStatus.CLOSED,
        winnerPushClaimed: false,
        highBid: { $ne: null },
    }).lean();
    for (const item of unpushed) {
        try {
            if ((await isWinnerPaid(item)) && (await claimAndSendWinnerPush(item))) {
                summary.pushes++;
            }
        } catch (error) {
            console.error(`${LOG} timer: won push failed item=${item.itemId}`, error);
        }
    }

    // 5. Summary
    console.log(`${LOG} timer run done ${JSON.stringify(summary)}`);
    return summary;
}

// Every leader of an open item must hold the points. Flags the item for staff if not.
async function checkLeader(item: AuctionItem, summary: TimerSummary): Promise<void> {
    const leaderId = item.highBid!.userId;
    const leader = await Models.AttendeeProfile.findOne({ userId: leaderId }).lean();
    if (findHold(leader?.auctionHolds, item.itemId)) {
        return;
    }
    // Only flag if the item did not change since we read it (an outbid may be in progress)
    const flagged = await Models.AuctionItem.updateOne(
        { itemId: item.itemId, version: item.version },
        { $set: { needsReview: true } },
    );
    if (flagged.modifiedCount === 1) {
        console.error(`${LOG} timer: leader has no hold, needs review item=${item.itemId} user=${leaderId}`);
        summary.review++;
    }
}

let runningSince: number | null = null;

// Skips a run while the last one is still going, unless the last one looks stuck
export async function runAuctionTimerGuarded(clock: Clock): Promise<"ran" | "skipped"> {
    const startedAt = clock().getTime();
    if (runningSince !== null) {
        if (startedAt - runningSince < MAX_RUN_MS) {
            console.log(`${LOG} timer: last run still going, skipped`);
            return "skipped";
        }
        console.error(`${LOG} timer: last run stuck for ${startedAt - runningSince} ms, starting a new run`);
    }
    runningSince = startedAt;
    try {
        await runAuctionTimer(clock);
    } catch (error) {
        console.error(`${LOG} timer run failed`, error);
    } finally {
        if (runningSince === startedAt) {
            runningSince = null;
        }
    }
    return "ran";
}

async function tick(): Promise<void> {
    try {
        // A missing value (the current production config) means ON
        if ((await RuntimeConfig.get("auctionTimerEnabled")) === false) {
            return;
        }
    } catch (error) {
        console.error(`${LOG} timer: could not read runtime config, running anyway`, error);
    }
    await runAuctionTimerGuarded(() => new Date());
}

export function startAuctionTimer(): void {
    setInterval(() => void tick(), TIMER_INTERVAL_MS);
    console.log(`${LOG} timer started, every ${TIMER_INTERVAL_MS / Config.MILLISECONDS_PER_SECOND} s`);
}
