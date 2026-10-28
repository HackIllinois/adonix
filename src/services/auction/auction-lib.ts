import { randomUUID } from "crypto";
import Models from "../../common/models";
import { sendNotification } from "../notification/notification-service";
import { AuctionHold, AuctionItem, AuctionStatus } from "./auction-schemas";

/*
 * Auction rules. Plan: planning/auction-backend-plan.md (HackIllinois workspace).
 *
 * The hold rule: for each item, only the leader has a hold, and its bidId and amount equal the
 * item's highBid. Every points change is ONE write to ONE profile that also changes the hold, and
 * it runs only if the hold still has the expected bidId. Every item change checks and raises
 * `version`. So a repeated or stale write never matches, and the timer can always repair.
 */

export type Clock = () => Date;
export type Result<T, E extends string> = { ok: true; value: T } | { ok: false; error: E };

export const EXTENSION_MS = 120_000;
export const STALE_HOLD_MS = 60_000;
const MAX_ATTEMPTS = 3;
const HOLD_RECHECK_MS = 50;

const LOG = "[auction]";

function ok<T>(value: T): { ok: true; value: T } {
    return { ok: true, value };
}

function fail<E extends string>(error: E): { ok: false; error: E } {
    return { ok: false, error };
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isEffectivelyOpen(item: AuctionItem, now: Date): boolean {
    return item.status === AuctionStatus.OPEN && item.closeTime.getTime() > now.getTime();
}

export function effectiveStatus(item: AuctionItem, now: Date): AuctionStatus {
    if (item.status === AuctionStatus.OPEN && !isEffectivelyOpen(item, now)) {
        return AuctionStatus.CLOSED;
    }
    return item.status;
}

export function nextMinimum(item: AuctionItem): number {
    return item.highBid ? item.highBid.amount + item.step : item.startPrice;
}

export function findHold(holds: AuctionHold[] | undefined, itemId: string): AuctionHold | undefined {
    return holds?.find((hold) => hold.itemId === itemId);
}

// ---------- The 4 points writes. Each is one write to one profile. ----------

export async function placeHold(userId: string, itemId: string, bidId: string, amount: number, now: Date): Promise<boolean> {
    const result = await Models.AttendeeProfile.updateOne(
        { userId, points: { $gte: amount }, "auctionHolds.itemId": { $ne: itemId } },
        { $inc: { points: -amount }, $push: { auctionHolds: { itemId, bidId, amount, at: now } } },
    );
    const matched = result.modifiedCount === 1;
    console.log(`${LOG} placeHold user=${userId} item=${itemId} bid=${bidId} amount=${amount} matched=${matched}`);
    return matched;
}

// Moves a hold from one bid to another. Can raise (takes more points) or lower (gives points back).
export async function replaceHold(
    userId: string,
    itemId: string,
    from: { bidId: string; amount: number },
    to: { bidId: string; amount: number },
    now: Date,
): Promise<boolean> {
    const extra = to.amount - from.amount;
    const result = await Models.AttendeeProfile.updateOne(
        {
            userId,
            auctionHolds: { $elemMatch: { itemId, bidId: from.bidId, amount: from.amount } },
            ...(extra > 0 ? { points: { $gte: extra } } : {}),
        },
        {
            $inc: { points: -extra },
            $set: { "auctionHolds.$.bidId": to.bidId, "auctionHolds.$.amount": to.amount, "auctionHolds.$.at": now },
        },
    );
    const matched = result.modifiedCount === 1;
    console.log(
        `${LOG} replaceHold user=${userId} item=${itemId} ${from.bidId}:${from.amount} -> ${to.bidId}:${to.amount} matched=${matched}`,
    );
    return matched;
}

export async function releaseHold(userId: string, itemId: string, hold: { bidId: string; amount: number }): Promise<boolean> {
    const result = await Models.AttendeeProfile.updateOne(
        { userId, auctionHolds: { $elemMatch: { itemId, bidId: hold.bidId, amount: hold.amount } } },
        { $inc: { points: hold.amount }, $pull: { auctionHolds: { itemId, bidId: hold.bidId } } },
    );
    const matched = result.modifiedCount === 1;
    console.log(`${LOG} releaseHold user=${userId} item=${itemId} bid=${hold.bidId} amount=${hold.amount} matched=${matched}`);
    return matched;
}

// Moves a hold to auctionWins. Keeps `keep` points spent and gives back the rest.
export async function settleHold(
    userId: string,
    itemId: string,
    hold: { bidId: string; amount: number },
    keep: number,
    now: Date,
): Promise<boolean> {
    if (keep > hold.amount) {
        console.error(`${LOG} settleHold refused: keep=${keep} > held=${hold.amount} user=${userId} item=${itemId}`);
        return false;
    }
    const result = await Models.AttendeeProfile.updateOne(
        {
            userId,
            auctionHolds: { $elemMatch: { itemId, bidId: hold.bidId, amount: hold.amount } },
            "auctionWins.itemId": { $ne: itemId },
        },
        {
            $inc: { points: hold.amount - keep },
            $pull: { auctionHolds: { itemId, bidId: hold.bidId } },
            $push: { auctionWins: { itemId, bidId: hold.bidId, amount: keep, at: now } },
        },
    );
    const matched = result.modifiedCount === 1;
    console.log(
        `${LOG} settleHold user=${userId} item=${itemId} bid=${hold.bidId} held=${hold.amount} keep=${keep} matched=${matched}`,
    );
    return matched;
}

// ---------- Push ----------

export async function notifyUser(userId: string, title: string, body: string): Promise<void> {
    try {
        const mapping = await Models.NotificationMappings.findOne({ userId });
        if (!mapping) {
            console.log(`${LOG} push skipped, no device token user=${userId}`);
            return;
        }
        await sendNotification({ token: mapping.deviceToken, title, body });
        console.log(`${LOG} push sent user=${userId} title="${title}"`);
    } catch (error) {
        console.error(`${LOG} push failed user=${userId} title="${title}"`, error);
    }
}

// ---------- Bid ----------

export type BidError =
    | "NotFound"
    | "AuctionClosed"
    | "AuctionCancelled"
    | "BidTooLow"
    | "InsufficientFunds"
    | "NoProfile"
    | "BidConflict";

export interface BidPlan {
    userId: string;
    itemId: string;
    itemName: string;
    amount: number;
    version: number;
    // Set for a self-raise: the bidder's current hold (which equals the item's highBid)
    currentHold: { bidId: string; amount: number } | null;
    // The leader before this bid, if it is a different user
    previousLeader: { userId: string; bidId: string; amount: number } | null;
}

// Bid step 1 and 2: read, check the rules, and decide new bid vs self-raise
export async function prepareBid(userId: string, itemId: string, amount: number, now: Date): Promise<Result<BidPlan, BidError>> {
    const item = await Models.AuctionItem.findOne({ itemId }).lean();
    if (!item) {
        return fail("NotFound");
    }
    if (item.status === AuctionStatus.CANCELLED) {
        return fail("AuctionCancelled");
    }
    if (!isEffectivelyOpen(item, now)) {
        return fail("AuctionClosed");
    }
    const profile = await Models.AttendeeProfile.findOne({ userId }).lean();
    if (!profile) {
        return fail("NoProfile");
    }
    if (amount < nextMinimum(item)) {
        return fail("BidTooLow");
    }

    const hold = findHold(profile.auctionHolds, itemId);
    const leads = !!hold && !!item.highBid && hold.bidId === item.highBid.bidId;
    if (hold && !leads) {
        // Another bid by this user is in progress, or an old one stopped (the timer clears it)
        return fail("BidConflict");
    }
    const currentHold = leads ? { bidId: hold.bidId, amount: hold.amount } : null;
    if (amount > profile.points + (currentHold?.amount ?? 0)) {
        return fail("InsufficientFunds");
    }

    const previousLeader =
        item.highBid && item.highBid.userId !== userId
            ? { userId: item.highBid.userId, bidId: item.highBid.bidId, amount: item.highBid.amount }
            : null;

    return ok({ userId, itemId, itemName: item.name, amount, version: item.version, currentHold, previousLeader });
}

// Bid step 3: take the points. Returns the new bidId.
export async function reserveBid(plan: BidPlan, now: Date): Promise<Result<string, "InsufficientFunds" | "Changed">> {
    const bidId = randomUUID();
    const matched = plan.currentHold
        ? await replaceHold(plan.userId, plan.itemId, plan.currentHold, { bidId, amount: plan.amount }, now)
        : await placeHold(plan.userId, plan.itemId, bidId, plan.amount, now);
    if (matched) {
        return ok(bidId);
    }

    // Find out why: not enough points, or the hold changed since step 1
    const profile = await Models.AttendeeProfile.findOne({ userId: plan.userId }).lean();
    const hold = findHold(profile?.auctionHolds, plan.itemId);
    const holdUnchanged = plan.currentHold
        ? hold?.bidId === plan.currentHold.bidId && hold.amount === plan.currentHold.amount
        : hold === undefined;
    const available = (profile?.points ?? 0) + (plan.currentHold?.amount ?? 0);
    if (holdUnchanged && available < plan.amount) {
        return fail("InsufficientFunds");
    }
    return fail("Changed");
}

// Bid step 4: make the bid the leader. Returns null if the item changed (no write happened).
// Throws if the database throws: then the outcome is unknown, and the caller must NOT undo.
export async function commitBid(plan: BidPlan, bidId: string, clock: Clock): Promise<AuctionItem | null> {
    const now = clock();
    const bid = { userId: plan.userId, amount: plan.amount, bidId, time: now };
    const updated = await Models.AuctionItem.findOneAndUpdate(
        {
            itemId: plan.itemId,
            version: plan.version,
            status: AuctionStatus.OPEN,
            closeTime: { $gt: now },
            startPrice: { $lte: plan.amount },
        },
        {
            $set: { highBid: bid },
            $push: { bids: bid },
            $inc: { bidCount: 1, version: 1 },
            // Only moves the close time if less than EXTENSION_MS are left
            $max: { closeTime: new Date(now.getTime() + EXTENSION_MS) },
        },
        { new: true },
    ).lean();
    console.log(
        `${LOG} commitBid user=${plan.userId} item=${plan.itemId} bid=${bidId} amount=${plan.amount} matched=${!!updated}`,
    );
    return updated;
}

// Bid step 5: give back what step 3 took. Changes nothing if the timer already repaired the hold.
export async function undoReserve(plan: BidPlan, bidId: string, now: Date): Promise<void> {
    if (plan.currentHold) {
        await replaceHold(plan.userId, plan.itemId, { bidId, amount: plan.amount }, plan.currentHold, now);
    } else {
        await releaseHold(plan.userId, plan.itemId, { bidId, amount: plan.amount });
    }
}

// Bid step 6: refund the old leader
export async function releaseOutbid(plan: BidPlan): Promise<void> {
    if (!plan.previousLeader) {
        return;
    }
    const { userId, bidId, amount } = plan.previousLeader;
    await releaseHold(userId, plan.itemId, { bidId, amount });
}

async function prepareWithRecheck(
    userId: string,
    itemId: string,
    amount: number,
    clock: Clock,
): Promise<Result<BidPlan, BidError>> {
    const first = await prepareBid(userId, itemId, amount, clock());
    if (first.ok || first.error !== "BidConflict") {
        return first;
    }
    // The user may have been outbid a few ms ago and the refund is not written yet. Look once more.
    await sleep(HOLD_RECHECK_MS);
    return prepareBid(userId, itemId, amount, clock());
}

export async function placeBid(
    userId: string,
    itemId: string,
    amount: number,
    clock: Clock,
): Promise<Result<AuctionItem, BidError>> {
    console.log(`${LOG} bid start user=${userId} item=${itemId} amount=${amount}`);
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const prepared = await prepareWithRecheck(userId, itemId, amount, clock);
        if (!prepared.ok) {
            console.log(`${LOG} bid rejected user=${userId} item=${itemId} attempt=${attempt} error=${prepared.error}`);
            return prepared;
        }
        const plan = prepared.value;

        const reserved = await reserveBid(plan, clock());
        if (!reserved.ok) {
            if (reserved.error === "InsufficientFunds") {
                console.log(`${LOG} bid rejected user=${userId} item=${itemId} error=InsufficientFunds`);
                return fail("InsufficientFunds");
            }
            console.log(`${LOG} bid retry user=${userId} item=${itemId} attempt=${attempt} reason=hold-changed`);
            continue;
        }
        const bidId = reserved.value;

        let updated: AuctionItem | null;
        try {
            updated = await commitBid(plan, bidId, clock);
        } catch (error) {
            // Outcome unknown. Do not undo: the timer makes the hold match the item.
            console.error(`${LOG} commitBid threw, no undo user=${userId} item=${itemId} bid=${bidId}`, error);
            throw error;
        }

        if (!updated) {
            await undoReserve(plan, bidId, clock());
            console.log(`${LOG} bid retry user=${userId} item=${itemId} attempt=${attempt} reason=item-changed`);
            continue;
        }

        try {
            await releaseOutbid(plan);
        } catch (error) {
            console.error(`${LOG} outbid release failed, timer will finish it item=${itemId}`, error);
        }
        if (plan.previousLeader) {
            void notifyUser(plan.previousLeader.userId, "You were outbid", `Someone outbid you on ${plan.itemName}.`);
        }
        console.log(`${LOG} bid done user=${userId} item=${itemId} bid=${bidId} amount=${amount}`);
        return ok(updated);
    }

    // Out of attempts: report the item's state if it changed, else ask to try again
    const final = await prepareBid(userId, itemId, amount, clock());
    const error = !final.ok && final.error !== "BidConflict" ? final.error : "BidConflict";
    console.log(`${LOG} bid gave up user=${userId} item=${itemId} error=${error}`);
    return fail(error);
}

// ---------- Cancel ----------

export type CancelError = "NotFound" | "AuctionClosed" | "AuctionCancelled" | "BidConflict";

export async function markCancelled(item: AuctionItem, now: Date): Promise<AuctionItem | null> {
    return Models.AuctionItem.findOneAndUpdate(
        { itemId: item.itemId, version: item.version, status: AuctionStatus.OPEN, closeTime: { $gt: now } },
        { $set: { status: AuctionStatus.CANCELLED }, $inc: { version: 1 } },
        { new: true },
    ).lean();
}

export async function releaseCancelledLeader(item: AuctionItem): Promise<void> {
    if (item.highBid) {
        await releaseHold(item.highBid.userId, item.itemId, item.highBid);
    }
}

export async function cancelItem(itemId: string, clock: Clock): Promise<Result<AuctionItem, CancelError>> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const item = await Models.AuctionItem.findOne({ itemId }).lean();
        if (!item) {
            return fail("NotFound");
        }
        if (item.status === AuctionStatus.CANCELLED) {
            return fail("AuctionCancelled");
        }
        if (!isEffectivelyOpen(item, clock())) {
            return fail("AuctionClosed");
        }
        const cancelled = await markCancelled(item, clock());
        if (!cancelled) {
            console.log(`${LOG} cancel retry item=${itemId} attempt=${attempt}`);
            continue;
        }
        try {
            await releaseCancelledLeader(cancelled);
        } catch (error) {
            console.error(`${LOG} cancel refund failed, timer will finish it item=${itemId}`, error);
        }
        console.log(`${LOG} cancelled item=${itemId} leader=${cancelled.highBid?.userId ?? "none"}`);
        return ok(cancelled);
    }
    return fail("BidConflict");
}

// ---------- Close ----------

export async function markClosed(item: AuctionItem, now: Date): Promise<AuctionItem | null> {
    return Models.AuctionItem.findOneAndUpdate(
        { itemId: item.itemId, version: item.version, status: AuctionStatus.OPEN, closeTime: { $lte: now } },
        { $set: { status: AuctionStatus.CLOSED }, $inc: { version: 1 } },
        { new: true },
    ).lean();
}

export type SettleOutcome = "unsold" | "settled" | "already" | "review";

// Moves the winner's hold to auctionWins. Safe to run many times and from two timers at once.
export async function settleWinner(itemId: string, now: Date): Promise<SettleOutcome> {
    const item = await Models.AuctionItem.findOne({ itemId }).lean();
    if (!item || item.status !== AuctionStatus.CLOSED) {
        console.error(`${LOG} settleWinner on item that is not closed item=${itemId}`);
        return "review";
    }
    const highBid = item.highBid;
    if (!highBid) {
        return "unsold";
    }

    for (let attempt = 1; attempt <= 2; attempt++) {
        const profile = await Models.AttendeeProfile.findOne({ userId: highBid.userId }).lean();
        if (findHold(profile?.auctionWins, itemId)) {
            return "already";
        }
        const hold = findHold(profile?.auctionHolds, itemId);
        // The hold is the winning bid, or a self-raise that stopped before its item write (more points held)
        if (hold && (hold.bidId === highBid.bidId || hold.amount >= highBid.amount)) {
            if (await settleHold(highBid.userId, itemId, hold, highBid.amount, now)) {
                return "settled";
            }
        }
    }

    console.error(`${LOG} winner has no matching hold, needs review item=${itemId} user=${highBid.userId}`);
    await Models.AuctionItem.updateOne({ itemId }, { $set: { needsReview: true } });
    return "review";
}

// Sends the "won" push at most once: only the caller that flips the claim sends it
export async function claimAndSendWinnerPush(item: AuctionItem): Promise<boolean> {
    if (!item.highBid) {
        return false;
    }
    const claimed = await Models.AuctionItem.updateOne(
        { itemId: item.itemId, winnerPushClaimed: false },
        { $set: { winnerPushClaimed: true } },
    );
    if (claimed.modifiedCount !== 1) {
        return false;
    }
    await notifyUser(item.highBid.userId, "You won!", `You won ${item.name}. Pick it up at the shop desk.`);
    return true;
}

// ---------- Organizer actions ----------

export interface AuctionItemFields {
    name: string;
    description: string;
    imageURL: string;
    startPrice: number;
    step: number;
    closeTime: Date;
}

export async function createItem(fields: AuctionItemFields, now: Date): Promise<Result<AuctionItem, "InvalidCloseTime">> {
    if (fields.closeTime.getTime() <= now.getTime()) {
        return fail("InvalidCloseTime");
    }
    const created = await Models.AuctionItem.create({
        ...fields,
        itemId: randomUUID(),
        originalCloseTime: fields.closeTime,
        status: AuctionStatus.OPEN,
    });
    console.log(`${LOG} created item=${created.itemId} name="${fields.name}"`);
    return ok(created.toObject());
}

export type UpdateError = "NotFound" | "AuctionClosed" | "AuctionCancelled" | "HasBids" | "InvalidCloseTime" | "BidConflict";

export async function updateItem(
    itemId: string,
    changes: Partial<AuctionItemFields>,
    clock: Clock,
): Promise<Result<AuctionItem, UpdateError>> {
    const now = clock();
    if (changes.closeTime && changes.closeTime.getTime() <= now.getTime()) {
        return fail("InvalidCloseTime");
    }
    const item = await Models.AuctionItem.findOne({ itemId }).lean();
    if (!item) {
        return fail("NotFound");
    }
    if (item.status === AuctionStatus.CANCELLED) {
        return fail("AuctionCancelled");
    }
    if (!isEffectivelyOpen(item, now)) {
        return fail("AuctionClosed");
    }
    if (item.bidCount > 0) {
        return fail("HasBids");
    }
    const set: Partial<AuctionItem> = { ...changes };
    if (changes.closeTime) {
        set.originalCloseTime = changes.closeTime;
    }
    const updated = await Models.AuctionItem.findOneAndUpdate(
        { itemId, version: item.version, status: AuctionStatus.OPEN, bidCount: 0, closeTime: { $gt: clock() } },
        { $set: set, $inc: { version: 1 } },
        { new: true },
    ).lean();
    if (!updated) {
        console.log(`${LOG} edit lost a race item=${itemId}`);
        return fail("BidConflict");
    }
    console.log(`${LOG} edited item=${itemId} fields=${Object.keys(changes).join(",")}`);
    return ok(updated);
}

export async function reopenItem(
    itemId: string,
    closeTime: Date,
    clock: Clock,
): Promise<Result<AuctionItem, "NotFound" | "NotUnsold" | "InvalidCloseTime" | "BidConflict">> {
    const now = clock();
    if (closeTime.getTime() <= now.getTime()) {
        return fail("InvalidCloseTime");
    }
    const item = await Models.AuctionItem.findOne({ itemId }).lean();
    if (!item) {
        return fail("NotFound");
    }
    if (effectiveStatus(item, now) !== AuctionStatus.CLOSED || item.highBid) {
        return fail("NotUnsold");
    }
    const updated = await Models.AuctionItem.findOneAndUpdate(
        { itemId, version: item.version, highBid: null, status: { $in: [AuctionStatus.OPEN, AuctionStatus.CLOSED] } },
        { $set: { status: AuctionStatus.OPEN, closeTime, originalCloseTime: closeTime }, $inc: { version: 1 } },
        { new: true },
    ).lean();
    if (!updated) {
        return fail("BidConflict");
    }
    console.log(`${LOG} reopened item=${itemId}`);
    return ok(updated);
}

export async function isWinnerPaid(item: AuctionItem): Promise<boolean> {
    if (!item.highBid || item.status !== AuctionStatus.CLOSED) {
        return false;
    }
    const profile = await Models.AttendeeProfile.findOne({ userId: item.highBid.userId }).lean();
    return !!findHold(profile?.auctionWins, item.itemId);
}

export async function markPickedUp(
    itemId: string,
    staffId: string,
    now: Date,
): Promise<Result<AuctionItem, "NotFound" | "NoWinner" | "AlreadyPickedUp">> {
    const item = await Models.AuctionItem.findOne({ itemId }).lean();
    if (!item) {
        return fail("NotFound");
    }
    if (item.pickedUp) {
        return fail("AlreadyPickedUp");
    }
    if (!(await isWinnerPaid(item))) {
        return fail("NoWinner");
    }
    const updated = await Models.AuctionItem.findOneAndUpdate(
        { itemId, status: AuctionStatus.CLOSED, pickedUp: null },
        { $set: { pickedUp: { by: staffId, at: now } } },
        { new: true },
    ).lean();
    if (!updated) {
        return fail("AlreadyPickedUp");
    }
    console.log(`${LOG} picked up item=${itemId} by=${staffId}`);
    return ok(updated);
}
