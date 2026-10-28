import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { StatusCode } from "status-code-enum";
import Models from "../../common/models";
import { getAsStaff, getAsUser, postAsStaff, postAsUser, putAsStaff, TESTER } from "../../common/testTools";
import * as notificationService from "../notification/notification-service";
import { runAuctionTimer } from "./auction-timer";
import { placeBid } from "./auction-lib";
import {
    HOUR_MS,
    expectFinalInvariants,
    getItem,
    getProfile,
    seedItem,
    seedProfile,
    totalPoints,
    waitForPushes,
} from "./auction-test-helpers";

const OTHER = "other-bidder";
const realClock = (): Date => new Date();
const inSeconds = (ms: number): number => Math.ceil(ms / 1000);

let startingTotal: number;
let sendSpy: jest.SpiedFunction<typeof notificationService.sendNotification>;

beforeEach(async () => {
    sendSpy = jest.spyOn(notificationService, "sendNotification").mockResolvedValue({ status: "ok", id: "ticket" });
    await seedProfile(TESTER.id, 200);
    await seedProfile(OTHER, 300);
    await Models.NotificationMappings.create({ userId: OTHER, deviceToken: "ExponentPushToken[other]" });
    await seedItem({ closeTime: new Date(Date.now() + HOUR_MS) });
    startingTotal = await totalPoints();
});

afterEach(async () => {
    await expectFinalInvariants(startingTotal);
});

async function closeNow(itemId = "hoodie"): Promise<void> {
    await Models.AuctionItem.updateOne({ itemId }, { $set: { closeTime: new Date(Date.now() - 1000) } });
    await runAuctionTimer(realClock);
}

describe("POST /auction/item/", () => {
    const body = { name: "Mug", description: "A mug", imageURL: "https://example.com/m.png", startPrice: 10, step: 2 };

    it("lets staff create an item with a server-made id", async () => {
        const closeTime = inSeconds(Date.now() + HOUR_MS);
        const response = await postAsStaff("/auction/item/")
            .send({ ...body, closeTime })
            .expect(StatusCode.SuccessOK);
        expect(response.body).toMatchObject({ ...body, closeTime, originalCloseTime: closeTime, status: "OPEN", highBid: null });
        expect(response.body.itemId).toEqual(expect.any(String));
        expect(await Models.AuctionItem.countDocuments()).toBe(2);
    });

    it("refuses a past close time and a bad start price", async () => {
        await postAsStaff("/auction/item/")
            .send({ ...body, closeTime: inSeconds(Date.now() - 1000) })
            .expect(StatusCode.ClientErrorBadRequest)
            .expect((res) => expect(res.body.error).toBe("InvalidCloseTime"));
        await postAsStaff("/auction/item/")
            .send({ ...body, startPrice: 0, closeTime: inSeconds(Date.now() + HOUR_MS) })
            .expect(StatusCode.ClientErrorBadRequest);
    });

    it("refuses a user who is not staff", async () => {
        await postAsUser("/auction/item/")
            .send({ ...body, closeTime: inSeconds(Date.now() + HOUR_MS) })
            .expect(StatusCode.ClientErrorForbidden);
    });
});

describe("attendee views", () => {
    it("shows the high bid and whether I lead, with no names or user ids", async () => {
        await postAsUser("/auction/hoodie/bid/").send({ amount: 60 }).expect(StatusCode.SuccessOK);
        const list = await getAsUser("/auction/").expect(StatusCode.SuccessOK);
        expect(list.body.items).toEqual([
            expect.objectContaining({
                itemId: "hoodie",
                highBid: 60,
                nextMinimum: 65,
                bidCount: 1,
                youLead: true,
                status: "OPEN",
            }),
        ]);
        expect(list.text).not.toContain(TESTER.id);
        expect(list.text).not.toContain("name-of-");
        expect(list.text).not.toContain("bidId");

        const one = await getAsUser("/auction/hoodie/").expect(StatusCode.SuccessOK);
        expect(one.body).toMatchObject({ itemId: "hoodie", youLead: true });
        expect(one.text).not.toContain(TESTER.id);
    });

    it("returns NotFound for an unknown item", async () => {
        await getAsUser("/auction/nope/")
            .expect(StatusCode.ClientErrorNotFound)
            .expect((res) => expect(res.body.error).toBe("NotFound"));
    });

    it("hides a cancelled item from attendees", async () => {
        await postAsStaff("/auction/item/hoodie/cancel/").expect(StatusCode.SuccessOK);
        await getAsUser("/auction/hoodie/")
            .expect(StatusCode.ClientErrorNotFound)
            .expect((res) => expect(res.body.error).toBe("NotFound"));
    });

    it("does not list an item past its close time as leading, before the timer closes it", async () => {
        await postAsUser("/auction/hoodie/bid/").send({ amount: 60 }).expect(StatusCode.SuccessOK);
        await Models.AuctionItem.updateOne({ itemId: "hoodie" }, { $set: { closeTime: new Date(Date.now() - 1000) } });
        const me = await getAsUser("/auction/me/").expect(StatusCode.SuccessOK);
        expect(me.body.leading).toEqual([]);
    });

    it("lists what I lead and what I won under /auction/me/ (not read as an item id)", async () => {
        await postAsUser("/auction/hoodie/bid/").send({ amount: 60 }).expect(StatusCode.SuccessOK);
        const leading = await getAsUser("/auction/me/").expect(StatusCode.SuccessOK);
        expect(leading.body).toEqual({ leading: [expect.objectContaining({ itemId: "hoodie" })], won: [] });

        await closeNow();
        const won = await getAsUser("/auction/me/").expect(StatusCode.SuccessOK);
        expect(won.body).toEqual({
            leading: [],
            won: [expect.objectContaining({ itemId: "hoodie", paid: 60, status: "CLOSED" })],
        });
    });
});

describe("POST /auction/{id}/bid/", () => {
    it("places a bid and takes the points", async () => {
        const response = await postAsUser("/auction/hoodie/bid/").send({ amount: 60 }).expect(StatusCode.SuccessOK);
        expect(response.body).toMatchObject({ highBid: 60, youLead: true });
        expect((await getProfile(TESTER.id)).points).toBe(140);
    });

    it("refuses amounts that are not whole numbers from 1 to 1,000,000", async () => {
        for (const amount of [0, 1.5, 1_000_001, "60"]) {
            await postAsUser("/auction/hoodie/bid/").send({ amount }).expect(StatusCode.ClientErrorBadRequest);
        }
    });

    it("returns BidTooLow, InsufficientFunds, and AuctionClosed with clear codes", async () => {
        await postAsUser("/auction/hoodie/bid/")
            .send({ amount: 49 })
            .expect(StatusCode.ClientErrorBadRequest)
            .expect((res) => expect(res.body.error).toBe("BidTooLow"));
        await postAsUser("/auction/hoodie/bid/")
            .send({ amount: 201 })
            .expect(StatusCode.ClientErrorPaymentRequired)
            .expect((res) => expect(res.body.error).toBe("InsufficientFunds"));
        await closeNow();
        await postAsUser("/auction/hoodie/bid/")
            .send({ amount: 60 })
            .expect(StatusCode.ClientErrorBadRequest)
            .expect((res) => expect(res.body.error).toBe("AuctionClosed"));
    });

    it("returns NoProfile for a user with no attendee profile", async () => {
        await Models.AttendeeProfile.deleteOne({ userId: TESTER.id });
        startingTotal = await totalPoints();
        await postAsUser("/auction/hoodie/bid/")
            .send({ amount: 60 })
            .expect(StatusCode.ClientErrorNotFound)
            .expect((res) => expect(res.body.error).toBe("NoProfile"));
    });

    it("still succeeds when the outbid push throws", async () => {
        sendSpy.mockRejectedValue(new Error("bad token"));
        await expect(placeBid(OTHER, "hoodie", 60, realClock)).resolves.toMatchObject({ ok: true });
        await postAsUser("/auction/hoodie/bid/").send({ amount: 70 }).expect(StatusCode.SuccessOK);
        await waitForPushes(sendSpy);
        expect(sendSpy).toHaveBeenCalledWith(expect.objectContaining({ token: "ExponentPushToken[other]" }));
        expect((await getProfile(OTHER)).points).toBe(300);
    });
});

describe("staff actions", () => {
    it("edits an item with no bids (close time sets both fields), and refuses after a bid", async () => {
        const closeTime = inSeconds(Date.now() + 2 * HOUR_MS);
        const edited = await putAsStaff("/auction/item/hoodie/").send({ name: "New", closeTime }).expect(StatusCode.SuccessOK);
        expect(edited.body).toMatchObject({ name: "New", closeTime, originalCloseTime: closeTime });
        await postAsUser("/auction/hoodie/bid/").send({ amount: 60 }).expect(StatusCode.SuccessOK);
        await putAsStaff("/auction/item/hoodie/")
            .send({ name: "Other" })
            .expect(StatusCode.ClientErrorBadRequest)
            .expect((res) => expect(res.body.error).toBe("HasBids"));
    });

    it("cancels an item and refunds the leader; a user cannot cancel", async () => {
        await postAsUser("/auction/hoodie/bid/").send({ amount: 60 }).expect(StatusCode.SuccessOK);
        await postAsUser("/auction/item/hoodie/cancel/").expect(StatusCode.ClientErrorForbidden);
        const cancelled = await postAsStaff("/auction/item/hoodie/cancel/").expect(StatusCode.SuccessOK);
        expect(cancelled.body.status).toBe("CANCELLED");
        expect(cancelled.body.highBid).toMatchObject({ userId: TESTER.id, displayName: `name-of-${TESTER.id}` });
        expect((await getProfile(TESTER.id)).points).toBe(200);
        await postAsUser("/auction/hoodie/bid/")
            .send({ amount: 70 })
            .expect(StatusCode.ClientErrorBadRequest)
            .expect((res) => expect(res.body.error).toBe("AuctionCancelled"));
    });

    it("reopens an unsold item, and refuses one with a winner or a past close time", async () => {
        await closeNow();
        await postAsStaff("/auction/item/hoodie/reopen/")
            .send({ closeTime: inSeconds(Date.now() - 1000) })
            .expect(StatusCode.ClientErrorBadRequest)
            .expect((res) => expect(res.body.error).toBe("InvalidCloseTime"));
        const reopened = await postAsStaff("/auction/item/hoodie/reopen/")
            .send({ closeTime: inSeconds(Date.now() + HOUR_MS) })
            .expect(StatusCode.SuccessOK);
        expect(reopened.body.status).toBe("OPEN");

        await postAsUser("/auction/hoodie/bid/").send({ amount: 60 }).expect(StatusCode.SuccessOK);
        await closeNow();
        await postAsStaff("/auction/item/hoodie/reopen/")
            .send({ closeTime: inSeconds(Date.now() + HOUR_MS) })
            .expect(StatusCode.ClientErrorBadRequest)
            .expect((res) => expect(res.body.error).toBe("NotUnsold"));
    });

    it("shows results with winner names under /auction/results/ (not read as an item id)", async () => {
        await postAsUser("/auction/hoodie/bid/").send({ amount: 60 }).expect(StatusCode.SuccessOK);
        await closeNow();
        const results = await getAsStaff("/auction/results/").expect(StatusCode.SuccessOK);
        expect(results.body.items).toEqual([
            expect.objectContaining({
                itemId: "hoodie",
                status: "CLOSED",
                highBid: expect.objectContaining({ userId: TESTER.id, displayName: `name-of-${TESTER.id}`, amount: 60 }),
                winnerPaid: true,
                needsReview: false,
                pickedUp: null,
            }),
        ]);
        await getAsUser("/auction/results/").expect(StatusCode.ClientErrorForbidden);
    });

    it("shows the full bid history with names to staff only", async () => {
        await postAsUser("/auction/hoodie/bid/").send({ amount: 60 }).expect(StatusCode.SuccessOK);
        const history = await getAsStaff("/auction/item/hoodie/bids/").expect(StatusCode.SuccessOK);
        expect(history.body.bids).toEqual([
            expect.objectContaining({ userId: TESTER.id, displayName: `name-of-${TESTER.id}`, amount: 60 }),
        ]);
        await getAsUser("/auction/item/hoodie/bids/").expect(StatusCode.ClientErrorForbidden);
    });

    it("marks pickup once for a paid winner, and refuses an unsold item", async () => {
        await postAsUser("/auction/hoodie/bid/").send({ amount: 60 }).expect(StatusCode.SuccessOK);
        await postAsStaff("/auction/item/hoodie/pickup/")
            .expect(StatusCode.ClientErrorBadRequest)
            .expect((res) => expect(res.body.error).toBe("NoWinner"));
        await closeNow();
        const picked = await postAsStaff("/auction/item/hoodie/pickup/").expect(StatusCode.SuccessOK);
        expect(picked.body.pickedUp).toEqual({ by: TESTER.id, at: expect.any(Number) });
        await postAsStaff("/auction/item/hoodie/pickup/")
            .expect(StatusCode.ClientErrorBadRequest)
            .expect((res) => expect(res.body.error).toBe("AlreadyPickedUp"));
        expect((await getItem()).pickedUp?.by).toBe(TESTER.id);
    });
});
