import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import Models from "../../common/models";
import * as notificationService from "../notification/notification-service";
import { AuctionStatus } from "./auction-schemas";
import {
    cancelItem,
    commitBid,
    markCancelled,
    markClosed,
    placeBid,
    prepareBid,
    releaseOutbid,
    reserveBid,
    settleWinner,
    undoReserve,
    updateItem,
} from "./auction-lib";
import { runAuctionTimer, runAuctionTimerGuarded } from "./auction-timer";
import {
    BASE_MS,
    HOUR_MS,
    expectFinalInvariants,
    getItem,
    getProfile,
    makeClock,
    seedItem,
    seedOldProfile,
    seedProfile,
    totalPoints,
    waitForPushes,
} from "./auction-test-helpers";

const ANA = "ana";
const BEN = "ben";
const CLOSE_MS = BASE_MS + HOUR_MS;

let time: ReturnType<typeof makeClock>;
let startingTotal: number;
let sendSpy: jest.SpiedFunction<typeof notificationService.sendNotification>;

beforeEach(async () => {
    time = makeClock();
    sendSpy = jest.spyOn(notificationService, "sendNotification").mockResolvedValue({ status: "ok", id: "ticket" });
    await seedProfile(ANA, 200);
    await seedProfile(BEN, 300);
    await Models.NotificationMappings.create({ userId: ANA, deviceToken: "ExponentPushToken[ana]" });
    await Models.NotificationMappings.create({ userId: BEN, deviceToken: "ExponentPushToken[ben]" });
    await Models.AttendeeTeam.create({ name: "Team 1", badge: "b", points: 1000, members: 2 });
    await seedItem();
    startingTotal = await totalPoints();
});

afterEach(async () => {
    await expectFinalInvariants(startingTotal);
});

async function mustPrepare(userId: string, amount: number, now = time.clock()): Promise<Parameters<typeof reserveBid>[0]> {
    const result = await prepareBid(userId, "hoodie", amount, now);
    if (!result.ok) {
        throw new Error(`prepare failed: ${result.error}`);
    }
    return result.value;
}

async function mustReserve(plan: Parameters<typeof reserveBid>[0]): Promise<string> {
    const result = await reserveBid(plan, time.clock());
    if (!result.ok) {
        throw new Error(`reserve failed: ${result.error}`);
    }
    return result.value;
}

function bid(userId: string, amount: number): ReturnType<typeof placeBid> {
    return placeBid(userId, "hoodie", amount, time.clock);
}

describe("bid rules", () => {
    it("rejects a first bid below the start price and accepts exactly the start price", async () => {
        await expect(bid(ANA, 49)).resolves.toEqual({ ok: false, error: "BidTooLow" });
        await expect(bid(ANA, 50)).resolves.toMatchObject({ ok: true });
    });

    it("rejects a later bid below high bid + step and accepts exactly high bid + step", async () => {
        await bid(ANA, 60);
        await expect(bid(BEN, 64)).resolves.toEqual({ ok: false, error: "BidTooLow" });
        await expect(bid(BEN, 65)).resolves.toMatchObject({ ok: true });
    });

    it("rejects a bid above the bidder's points and accepts exactly all points", async () => {
        await expect(bid(ANA, 201)).resolves.toEqual({ ok: false, error: "InsufficientFunds" });
        await expect(bid(ANA, 200)).resolves.toMatchObject({ ok: true });
        expect((await getProfile(ANA)).points).toBe(0);
    });

    it("rejects a bidder with no profile", async () => {
        await expect(bid("nobody", 60)).resolves.toEqual({ ok: false, error: "NoProfile" });
    });

    it("rejects an unknown item", async () => {
        await expect(placeBid(ANA, "missing", 60, time.clock)).resolves.toEqual({ ok: false, error: "NotFound" });
    });
});

describe("holds", () => {
    it("takes the bid from points, and does not change lifetime points, tier, or team points", async () => {
        await bid(ANA, 60);
        const ana = await getProfile(ANA);
        expect(ana.points).toBe(140);
        expect(ana.pointsAccumulated).toBe(500);
        expect(ana.tier).toBe(2);
        expect(ana.auctionHolds).toEqual([expect.objectContaining({ itemId: "hoodie", amount: 60 })]);
        expect((await Models.AttendeeTeam.findOne({ name: "Team 1" }))?.points).toBe(1000);
    });

    it("gives all held points back to the old leader on outbid, and sends an outbid push", async () => {
        await bid(ANA, 60);
        await bid(BEN, 80);
        const ana = await getProfile(ANA);
        expect(ana.points).toBe(200);
        expect(ana.auctionHolds).toEqual([]);
        expect((await getProfile(BEN)).points).toBe(220);
        await waitForPushes(sendSpy);
        expect(sendSpy).toHaveBeenCalledWith(expect.objectContaining({ token: "ExponentPushToken[ana]" }));
    });

    it("holds only the difference when the leader raises their own bid", async () => {
        await bid(ANA, 60);
        await expect(bid(ANA, 80)).resolves.toMatchObject({ ok: true });
        const ana = await getProfile(ANA);
        expect(ana.points).toBe(120);
        expect(ana.auctionHolds).toEqual([expect.objectContaining({ amount: 80 })]);
        expect(sendSpy).not.toHaveBeenCalled();
    });

    it("lets the leader raise up to points + current hold, and not more", async () => {
        await bid(ANA, 60);
        await expect(bid(ANA, 201)).resolves.toEqual({ ok: false, error: "InsufficientFunds" });
        await expect(bid(ANA, 200)).resolves.toMatchObject({ ok: true });
        expect((await getProfile(ANA)).points).toBe(0);
    });

    it("works for a profile made before auctions existed", async () => {
        await seedOldProfile("old", 100);
        startingTotal = await totalPoints();
        await expect(bid("old", 60)).resolves.toMatchObject({ ok: true });
        await bid(BEN, 70);
        expect((await getProfile("old")).points).toBe(100);
        await expect(bid("old", 80)).resolves.toMatchObject({ ok: true });
    });
});

describe("close time", () => {
    it("rejects a bid at the close time and after it, before the timer runs", async () => {
        time.set(CLOSE_MS);
        await expect(bid(ANA, 60)).resolves.toEqual({ ok: false, error: "AuctionClosed" });
        time.set(CLOSE_MS + 1000);
        await expect(bid(ANA, 60)).resolves.toEqual({ ok: false, error: "AuctionClosed" });
        expect((await getProfile(ANA)).points).toBe(200);
    });

    it("rejects a bid that stalls past the close time between its read and its item write", async () => {
        time.set(CLOSE_MS - 1000);
        const plan = await mustPrepare(ANA, 60);
        const bidId = await mustReserve(plan);
        time.set(CLOSE_MS);
        expect(await commitBid(plan, bidId, time.clock)).toBeNull();
        await undoReserve(plan, bidId, time.clock());
        expect((await getProfile(ANA)).points).toBe(200);
    });

    it("moves the close time to now + 120 s when a bid comes with 119 s left", async () => {
        time.set(CLOSE_MS - 119_000);
        await bid(ANA, 60);
        const item = await getItem();
        expect(item.closeTime.getTime()).toBe(CLOSE_MS - 119_000 + 120_000);
        expect(item.originalCloseTime.getTime()).toBe(CLOSE_MS);
    });

    it("does not move the close time with exactly 120 s left or with 180 s left", async () => {
        time.set(CLOSE_MS - 180_000);
        await bid(ANA, 60);
        expect((await getItem()).closeTime.getTime()).toBe(CLOSE_MS);
        time.set(CLOSE_MS - 120_000);
        await bid(BEN, 65);
        expect((await getItem()).closeTime.getTime()).toBe(CLOSE_MS);
    });
});

describe("concurrency", () => {
    it("lets only one of two same-user taps hold points (deterministic order)", async () => {
        const plan1 = await mustPrepare(ANA, 60);
        await mustReserve(plan1);
        // Tap 2 reads while tap 1 holds points but has not written the item yet
        await expect(prepareBid(ANA, "hoodie", 60, time.clock())).resolves.toEqual({ ok: false, error: "BidConflict" });
    });

    it("keeps points correct when one user taps two times at once", async () => {
        const results = await Promise.all([bid(ANA, 60), bid(ANA, 60)]);
        expect(results.filter((result) => result.ok)).toHaveLength(1);
        const ana = await getProfile(ANA);
        expect(ana.points).toBe(140);
        expect(ana.auctionHolds).toEqual([expect.objectContaining({ amount: 60 })]);
    });

    it("keeps points correct when the leader raises two times at once", async () => {
        await bid(ANA, 60);
        const results = await Promise.all([bid(ANA, 80), bid(ANA, 80)]);
        expect(results.filter((result) => result.ok)).toHaveLength(1);
        const ana = await getProfile(ANA);
        expect(ana.points).toBe(120);
        expect(ana.auctionHolds).toEqual([expect.objectContaining({ amount: 80 })]);
    });

    it("keeps points correct when two users bid at once", async () => {
        const results = await Promise.all([bid(ANA, 60), bid(BEN, 60)]);
        expect(results.filter((result) => result.ok)).toHaveLength(1);
        const item = await getItem();
        const leader = item.highBid!.userId;
        const other = leader === ANA ? BEN : ANA;
        expect((await getProfile(other)).auctionHolds ?? []).toEqual([]);
        expect((await getProfile(leader)).auctionHolds).toEqual([expect.objectContaining({ amount: 60 })]);
    });

    it("fails a stalled bid when another user bid in between, and refunds it", async () => {
        const plan = await mustPrepare(ANA, 60);
        const bidId = await mustReserve(plan);
        await bid(BEN, 60);
        expect(await commitBid(plan, bidId, time.clock)).toBeNull();
        await undoReserve(plan, bidId, time.clock());
        expect((await getProfile(ANA)).points).toBe(200);
        expect((await getProfile(BEN)).points).toBe(240);
    });

    it("fails a low bid when staff raise the start price during the bid", async () => {
        const plan = await mustPrepare(ANA, 50);
        const bidId = await mustReserve(plan);
        await expect(updateItem("hoodie", { startPrice: 70 }, time.clock)).resolves.toMatchObject({ ok: true });
        expect(await commitBid(plan, bidId, time.clock)).toBeNull();
        await undoReserve(plan, bidId, time.clock());
        expect((await getProfile(ANA)).points).toBe(200);
    });
});

describe("edit", () => {
    it("allows an edit with 0 bids, and refuses it after 1 bid", async () => {
        await expect(updateItem("hoodie", { name: "Better Hoodie" }, time.clock)).resolves.toMatchObject({ ok: true });
        await bid(ANA, 60);
        await expect(updateItem("hoodie", { name: "Other" }, time.clock)).resolves.toEqual({ ok: false, error: "HasBids" });
        expect((await getItem()).name).toBe("Better Hoodie");
    });

    it("sets both close times on an edit, and refuses a past close time", async () => {
        const newClose = new Date(CLOSE_MS + HOUR_MS);
        await updateItem("hoodie", { closeTime: newClose }, time.clock);
        const item = await getItem();
        expect(item.closeTime).toEqual(newClose);
        expect(item.originalCloseTime).toEqual(newClose);
        await expect(updateItem("hoodie", { closeTime: new Date(BASE_MS - 1) }, time.clock)).resolves.toEqual({
            ok: false,
            error: "InvalidCloseTime",
        });
    });

    it("refuses an edit on a closed item", async () => {
        time.set(CLOSE_MS);
        await expect(updateItem("hoodie", { name: "Late" }, time.clock)).resolves.toEqual({ ok: false, error: "AuctionClosed" });
    });
});

describe("cancel", () => {
    it("gives the leader all points back and rejects later bids", async () => {
        await bid(ANA, 60);
        await expect(cancelItem("hoodie", time.clock)).resolves.toMatchObject({ ok: true });
        expect((await getProfile(ANA)).points).toBe(200);
        await expect(bid(BEN, 70)).resolves.toEqual({ ok: false, error: "AuctionCancelled" });
    });

    it("refuses to cancel a closed item", async () => {
        time.set(CLOSE_MS);
        await expect(cancelItem("hoodie", time.clock)).resolves.toEqual({ ok: false, error: "AuctionClosed" });
    });

    it("keeps points correct when a cancel and a bid happen at once", async () => {
        await bid(ANA, 60);
        await Promise.all([cancelItem("hoodie", time.clock), bid(BEN, 70)]);
        expect((await getItem()).status).toBe(AuctionStatus.CANCELLED);
        expect((await getProfile(ANA)).points).toBe(200);
        expect((await getProfile(BEN)).points).toBe(300);
    });

    it("refunds the leader through the timer if Adonix stops after the cancel write", async () => {
        await bid(ANA, 60);
        expect(await markCancelled(await getItem(), time.clock())).not.toBeNull();
        expect((await getProfile(ANA)).points).toBe(140);
        time.advance(61_000);
        await runAuctionTimer(time.clock);
        expect((await getProfile(ANA)).points).toBe(200);
    });
});

describe("close", () => {
    it("closes a due item, keeps the winner's points spent, and sends one won push", async () => {
        await bid(ANA, 60);
        await bid(BEN, 80);
        sendSpy.mockClear();
        time.set(CLOSE_MS);
        await runAuctionTimer(time.clock);
        const item = await getItem();
        expect(item.status).toBe(AuctionStatus.CLOSED);
        const ben = await getProfile(BEN);
        expect(ben.points).toBe(220);
        expect(ben.auctionHolds).toEqual([]);
        expect(ben.auctionWins).toEqual([expect.objectContaining({ itemId: "hoodie", amount: 80 })]);
        await runAuctionTimer(time.clock);
        const wonPushes = sendSpy.mock.calls.filter(([message]) => message.title === "You won!");
        expect(wonPushes).toEqual([[expect.objectContaining({ token: "ExponentPushToken[ben]" })]]);
    });

    it("closes an item with no bids as unsold", async () => {
        time.set(CLOSE_MS);
        await runAuctionTimer(time.clock);
        const item = await getItem();
        expect(item.status).toBe(AuctionStatus.CLOSED);
        expect(item.highBid).toBeNull();
    });

    it("settles the winner through the timer if Adonix stops after the close write", async () => {
        await bid(ANA, 60);
        time.set(CLOSE_MS);
        expect(await markClosed(await getItem(), time.clock())).not.toBeNull();
        time.advance(61_000);
        await runAuctionTimer(time.clock);
        expect((await getProfile(ANA)).auctionWins).toEqual([expect.objectContaining({ amount: 60 })]);
        expect((await getItem()).needsReview).toBe(false);
    });

    it("gives the winner the difference back when a self-raise stopped before its item write", async () => {
        await bid(ANA, 60);
        const plan = await mustPrepare(ANA, 80);
        await mustReserve(plan);
        expect((await getProfile(ANA)).points).toBe(120);
        time.set(CLOSE_MS);
        await runAuctionTimer(time.clock);
        const ana = await getProfile(ANA);
        expect(ana.points).toBe(140);
        expect(ana.auctionWins).toEqual([expect.objectContaining({ amount: 60 })]);
    });

    it("does not mark review when the winner is already settled", async () => {
        await bid(ANA, 60);
        time.set(CLOSE_MS);
        await runAuctionTimer(time.clock);
        await expect(settleWinner("hoodie", time.clock())).resolves.toBe("already");
        expect((await getItem()).needsReview).toBe(false);
    });

    it("keeps points correct and sends at most one push when two timers run at once", async () => {
        await bid(ANA, 60);
        sendSpy.mockClear();
        time.set(CLOSE_MS);
        await Promise.all([runAuctionTimer(time.clock), runAuctionTimer(time.clock)]);
        await runAuctionTimer(time.clock);
        expect(sendSpy).toHaveBeenCalledTimes(1);
        expect((await getItem()).needsReview).toBe(false);
        expect((await getProfile(ANA)).auctionWins).toHaveLength(1);
    });

    it("still closes and settles when the push throws", async () => {
        sendSpy.mockRejectedValue(new Error("bad token"));
        await bid(ANA, 60);
        await bid(BEN, 70);
        time.set(CLOSE_MS);
        await runAuctionTimer(time.clock);
        expect((await getProfile(BEN)).auctionWins).toHaveLength(1);
    });
});

describe("timer repairs", () => {
    it("fails a slow new bid after the timer releases its hold, and refunds it only once", async () => {
        const plan = await mustPrepare(ANA, 60);
        const bidId = await mustReserve(plan);
        time.advance(61_000);
        await runAuctionTimer(time.clock);
        expect((await getProfile(ANA)).points).toBe(200);
        expect(await commitBid(plan, bidId, time.clock)).toBeNull();
        await undoReserve(plan, bidId, time.clock());
        expect((await getProfile(ANA)).points).toBe(200);
    });

    it("fails a slow self-raise after the timer puts the old hold back", async () => {
        await bid(ANA, 60);
        const plan = await mustPrepare(ANA, 80);
        const bidId = await mustReserve(plan);
        time.advance(61_000);
        await runAuctionTimer(time.clock);
        expect((await getProfile(ANA)).points).toBe(140);
        expect(await commitBid(plan, bidId, time.clock)).toBeNull();
        await undoReserve(plan, bidId, time.clock());
        const ana = await getProfile(ANA);
        expect(ana.points).toBe(140);
        expect(ana.auctionHolds).toEqual([expect.objectContaining({ amount: 60 })]);
    });

    it("refunds the old leader through the timer if Adonix stops before the outbid release", async () => {
        await bid(ANA, 60);
        const plan = await mustPrepare(BEN, 70);
        const bidId = await mustReserve(plan);
        expect(await commitBid(plan, bidId, time.clock)).not.toBeNull();
        expect((await getProfile(ANA)).points).toBe(140);
        time.advance(61_000);
        await runAuctionTimer(time.clock);
        expect((await getProfile(ANA)).points).toBe(200);
        await releaseOutbid(plan);
        expect((await getProfile(ANA)).points).toBe(200);
    });

    it("does not undo when the item write throws before it wrote; the timer refunds later", async () => {
        jest.spyOn(Models.AuctionItem, "findOneAndUpdate").mockImplementationOnce((() => ({
            lean: (): Promise<unknown> => Promise.reject(new Error("timeout")),
        })) as unknown as typeof Models.AuctionItem.findOneAndUpdate);
        await expect(bid(ANA, 60)).rejects.toThrow("timeout");
        expect((await getProfile(ANA)).points).toBe(140);
        time.advance(61_000);
        await runAuctionTimer(time.clock);
        expect((await getProfile(ANA)).points).toBe(200);
    });

    it("does not undo when the item write throws after it wrote; the bid stays and is paid", async () => {
        const original = Models.AuctionItem.findOneAndUpdate.bind(Models.AuctionItem);
        jest.spyOn(Models.AuctionItem, "findOneAndUpdate").mockImplementationOnce(((...args: Parameters<typeof original>) => ({
            lean: (): Promise<unknown> =>
                original(...args)
                    .lean()
                    .then(() => {
                        throw new Error("timeout after write");
                    }),
        })) as unknown as typeof Models.AuctionItem.findOneAndUpdate);
        await expect(bid(ANA, 60)).rejects.toThrow("timeout after write");
        expect((await getItem()).highBid?.userId).toBe(ANA);
        time.advance(61_000);
        await runAuctionTimer(time.clock);
        const ana = await getProfile(ANA);
        expect(ana.points).toBe(140);
        expect(ana.auctionHolds).toEqual([expect.objectContaining({ amount: 60 })]);
    });

    it("marks an open item for review when its leader has no hold", async () => {
        await bid(ANA, 60);
        await Models.AttendeeProfile.updateOne({ userId: ANA }, { $set: { auctionHolds: [] }, $inc: { points: 60 } });
        time.advance(61_000);
        await runAuctionTimer(time.clock);
        expect((await getItem()).needsReview).toBe(true);
    });

    it("skips a run while one is still going, and starts again after the time limit", async () => {
        let release: () => void = () => {};
        const stuck = new Promise<void>((resolve) => {
            release = resolve;
        });
        jest.spyOn(Models.AuctionItem, "find").mockImplementationOnce((() => ({
            lean: (): Promise<unknown> => stuck.then(() => []),
        })) as unknown as typeof Models.AuctionItem.find);
        const first = runAuctionTimerGuarded(time.clock);
        await expect(runAuctionTimerGuarded(time.clock)).resolves.toBe("skipped");
        // The next 30 s tick must also skip, or the guard never works in production
        time.advance(30_000);
        await expect(runAuctionTimerGuarded(time.clock)).resolves.toBe("skipped");
        time.advance(5 * 60_000);
        await expect(runAuctionTimerGuarded(time.clock)).resolves.toBe("ran");
        release();
        await first;
    });

    it("keeps going when one item fails to close", async () => {
        await seedItem({ itemId: "mug", name: "Mug", closeTime: new Date(CLOSE_MS) });
        jest.spyOn(Models.AuctionItem, "findOneAndUpdate").mockImplementationOnce((() => ({
            lean: (): Promise<unknown> => Promise.reject(new Error("db blip")),
        })) as unknown as typeof Models.AuctionItem.findOneAndUpdate);
        time.set(CLOSE_MS + 1000);
        const summary = await runAuctionTimer(time.clock);
        expect(summary.closed).toBe(1);
        const statuses = (await Models.AuctionItem.find().lean()).map((item) => item.status).sort();
        expect(statuses).toEqual([AuctionStatus.CLOSED, AuctionStatus.OPEN]);
    });
});
