import { Response, Router } from "express";
import { StatusCode } from "status-code-enum";
import { z } from "zod";
import { getAuthenticatedUser } from "../../common/auth";
import Config from "../../common/config";
import Models from "../../common/models";
import specification, { Tag } from "../../middleware/specification";
import { Role } from "../auth/auth-schemas";
import {
    AuctionAlreadyPickedUpError,
    AuctionAlreadyPickedUpErrorSchema,
    AuctionBidHistorySchema,
    AuctionBidRequestSchema,
    AuctionCancelledError,
    AuctionCancelledErrorSchema,
    AuctionClosedError,
    AuctionClosedErrorSchema,
    AuctionHasBidsError,
    AuctionHasBidsErrorSchema,
    AuctionInvalidCloseTimeError,
    AuctionInvalidCloseTimeErrorSchema,
    AuctionItemCreateRequestSchema,
    AuctionItemIdSchema,
    AuctionItemsViewSchema,
    AuctionItemUpdateRequestSchema,
    AuctionItemViewSchema,
    AuctionMeViewSchema,
    AuctionNotFoundError,
    AuctionNotFoundErrorSchema,
    AuctionNotUnsoldError,
    AuctionNotUnsoldErrorSchema,
    AuctionNoWinnerError,
    AuctionNoWinnerErrorSchema,
    AuctionReopenRequestSchema,
    AuctionResultsSchema,
    AuctionStaffItemSchema,
    AuctionItem,
    AuctionStaffItem,
    AuctionStatus,
    BidConflictError,
    BidConflictErrorSchema,
    BidInsufficientFundsError,
    BidInsufficientFundsErrorSchema,
    BidNoProfileError,
    BidNoProfileErrorSchema,
    BidTooLowError,
    BidTooLowErrorSchema,
} from "./auction-schemas";
import {
    cancelItem,
    createItem,
    findHold,
    isEffectivelyOpen,
    markPickedUp,
    placeBid,
    reopenItem,
    updateItem,
} from "./auction-lib";
import { displayNames, toAttendeeView, toEpochSeconds, toStaffView } from "./auction-views";

const LOG = "[auction]";
const clock = (): Date => new Date();
const fromEpochSeconds = (seconds: number): Date => new Date(seconds * Config.MILLISECONDS_PER_SECOND);

// Every error the auction lib can return, with its HTTP status and body
const ERRORS = {
    NotFound: [StatusCode.ClientErrorNotFound, AuctionNotFoundError],
    NoProfile: [StatusCode.ClientErrorNotFound, BidNoProfileError],
    AuctionClosed: [StatusCode.ClientErrorBadRequest, AuctionClosedError],
    AuctionCancelled: [StatusCode.ClientErrorBadRequest, AuctionCancelledError],
    BidTooLow: [StatusCode.ClientErrorBadRequest, BidTooLowError],
    HasBids: [StatusCode.ClientErrorBadRequest, AuctionHasBidsError],
    InvalidCloseTime: [StatusCode.ClientErrorBadRequest, AuctionInvalidCloseTimeError],
    NotUnsold: [StatusCode.ClientErrorBadRequest, AuctionNotUnsoldError],
    NoWinner: [StatusCode.ClientErrorBadRequest, AuctionNoWinnerError],
    AlreadyPickedUp: [StatusCode.ClientErrorBadRequest, AuctionAlreadyPickedUpError],
    InsufficientFunds: [StatusCode.ClientErrorPaymentRequired, BidInsufficientFundsError],
    BidConflict: [StatusCode.ClientErrorConflict, BidConflictError],
} as const;
type AuctionErrorName = keyof typeof ERRORS;

const notFoundResponse = { description: "Item doesn't exist", schema: AuctionNotFoundErrorSchema };
const closedResponse = { id: AuctionClosedError.error, description: "The item is closed", schema: AuctionClosedErrorSchema };
const cancelledResponse = {
    id: AuctionCancelledError.error,
    description: "The item was cancelled",
    schema: AuctionCancelledErrorSchema,
};
const conflictResponse = { description: "Another change happened at the same time, try again", schema: BidConflictErrorSchema };
const invalidCloseResponse = {
    id: AuctionInvalidCloseTimeError.error,
    description: "Close time is not in the future",
    schema: AuctionInvalidCloseTimeErrorSchema,
};
const itemIdParams = z.object({ id: AuctionItemIdSchema });

const auctionRouter = Router();

// Static paths come before "/:id/"
auctionRouter.get(
    "/me/",
    specification({
        method: "get",
        path: "/auction/me/",
        tag: Tag.AUCTION,
        role: Role.USER,
        summary: "Gets the auction items I lead now and the items I won",
        responses: {
            [StatusCode.SuccessOK]: { description: "My auction items", schema: AuctionMeViewSchema },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);
        const now = clock();
        const profile = await Models.AttendeeProfile.findOne({ userId }).lean();
        const holds = profile?.auctionHolds ?? [];
        const wins = profile?.auctionWins ?? [];
        const items = await Models.AuctionItem.find({ itemId: { $in: [...holds, ...wins].map((entry) => entry.itemId) } }).lean();

        // Lead only if my hold is the item's current high bid (a stale hold is not a lead)
        const leading = items
            .filter((item) => isEffectivelyOpen(item, now) && findHold(holds, item.itemId)?.bidId === item.highBid?.bidId)
            .filter((item) => item.highBid?.userId === userId)
            .map((item) => toAttendeeView(item, userId, now));
        const won = items.flatMap((item) => {
            const win = findHold(wins, item.itemId);
            return win ? [{ ...toAttendeeView(item, userId, now), paid: win.amount }] : [];
        });
        return res.status(StatusCode.SuccessOK).send({ leading, won });
    },
);

auctionRouter.get(
    "/results/",
    specification({
        method: "get",
        path: "/auction/results/",
        tag: Tag.AUCTION,
        role: Role.STAFF,
        summary: "Gets every auction item with its winner, pickup state, and review flag",
        responses: {
            [StatusCode.SuccessOK]: { description: "All items, staff view", schema: AuctionResultsSchema },
        },
    }),
    async (_req, res) => {
        const now = clock();
        const items = await Models.AuctionItem.find().lean();
        const names = await displayNames(items.flatMap((item) => (item.highBid ? [item.highBid.userId] : [])));
        const views = await Promise.all(items.map((item) => toStaffView(item, names, now)));
        return res.status(StatusCode.SuccessOK).send({ items: views });
    },
);

auctionRouter.get(
    "/",
    specification({
        method: "get",
        path: "/auction/",
        tag: Tag.AUCTION,
        role: Role.USER,
        summary: "Gets all open and closed auction items",
        responses: {
            [StatusCode.SuccessOK]: { description: "The items", schema: AuctionItemsViewSchema },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);
        const now = clock();
        const items = await Models.AuctionItem.find({ status: { $ne: AuctionStatus.CANCELLED } }).lean();
        return res.status(StatusCode.SuccessOK).send({ items: items.map((item) => toAttendeeView(item, userId, now)) });
    },
);

auctionRouter.post(
    "/item/",
    specification({
        method: "post",
        path: "/auction/item/",
        tag: Tag.AUCTION,
        role: Role.STAFF,
        summary: "Creates an auction item",
        body: AuctionItemCreateRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: { description: "The new item", schema: AuctionStaffItemSchema },
            [StatusCode.ClientErrorBadRequest]: {
                description: "Close time is not in the future",
                schema: AuctionInvalidCloseTimeErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { closeTime, ...fields } = req.body;
        console.log(`${LOG} POST /auction/item/ name="${fields.name}" closeTime=${closeTime}`);
        const result = await createItem({ ...fields, closeTime: fromEpochSeconds(closeTime) }, clock());
        if (!result.ok) {
            return sendError(res, result.error);
        }
        return res.status(StatusCode.SuccessOK).send(await staffViewWithNames(result.value));
    },
);

auctionRouter.put(
    "/item/:id/",
    specification({
        method: "put",
        path: "/auction/item/{id}/",
        tag: Tag.AUCTION,
        role: Role.STAFF,
        summary: "Edits an auction item. Only while open and before the first bid.",
        parameters: itemIdParams,
        body: AuctionItemUpdateRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: { description: "The edited item", schema: AuctionStaffItemSchema },
            [StatusCode.ClientErrorNotFound]: notFoundResponse,
            [StatusCode.ClientErrorBadRequest]: [
                { id: AuctionHasBidsError.error, description: "The item has bids", schema: AuctionHasBidsErrorSchema },
                invalidCloseResponse,
                closedResponse,
                cancelledResponse,
            ],
            [StatusCode.ClientErrorConflict]: conflictResponse,
        },
    }),
    async (req, res) => {
        const { id: itemId } = req.params;
        const { closeTime, ...rest } = req.body;
        console.log(`${LOG} PUT /auction/item/${itemId}/ fields=${Object.keys(req.body).join(",")}`);
        const changes = closeTime === undefined ? rest : { ...rest, closeTime: fromEpochSeconds(closeTime) };
        const result = await updateItem(itemId, changes, clock);
        if (!result.ok) {
            return sendError(res, result.error);
        }
        return res.status(StatusCode.SuccessOK).send(await staffViewWithNames(result.value));
    },
);

auctionRouter.post(
    "/item/:id/cancel/",
    specification({
        method: "post",
        path: "/auction/item/{id}/cancel/",
        tag: Tag.AUCTION,
        role: Role.STAFF,
        summary: "Cancels an open auction item and gives the leader all held points back",
        parameters: itemIdParams,
        responses: {
            [StatusCode.SuccessOK]: { description: "The cancelled item", schema: AuctionStaffItemSchema },
            [StatusCode.ClientErrorNotFound]: notFoundResponse,
            [StatusCode.ClientErrorBadRequest]: [closedResponse, cancelledResponse],
            [StatusCode.ClientErrorConflict]: conflictResponse,
        },
    }),
    async (req, res) => {
        const { id: itemId } = req.params;
        console.log(`${LOG} POST /auction/item/${itemId}/cancel/`);
        const result = await cancelItem(itemId, clock);
        if (!result.ok) {
            return sendError(res, result.error);
        }
        return res.status(StatusCode.SuccessOK).send(await staffViewWithNames(result.value));
    },
);

auctionRouter.post(
    "/item/:id/reopen/",
    specification({
        method: "post",
        path: "/auction/item/{id}/reopen/",
        tag: Tag.AUCTION,
        role: Role.STAFF,
        summary: "Reopens a closed item that got no bids",
        parameters: itemIdParams,
        body: AuctionReopenRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: { description: "The reopened item", schema: AuctionStaffItemSchema },
            [StatusCode.ClientErrorNotFound]: notFoundResponse,
            [StatusCode.ClientErrorBadRequest]: [
                {
                    id: AuctionNotUnsoldError.error,
                    description: "Not a closed item with no bids",
                    schema: AuctionNotUnsoldErrorSchema,
                },
                invalidCloseResponse,
            ],
            [StatusCode.ClientErrorConflict]: conflictResponse,
        },
    }),
    async (req, res) => {
        const { id: itemId } = req.params;
        console.log(`${LOG} POST /auction/item/${itemId}/reopen/ closeTime=${req.body.closeTime}`);
        const result = await reopenItem(itemId, fromEpochSeconds(req.body.closeTime), clock);
        if (!result.ok) {
            return sendError(res, result.error);
        }
        return res.status(StatusCode.SuccessOK).send(await staffViewWithNames(result.value));
    },
);

auctionRouter.get(
    "/item/:id/bids/",
    specification({
        method: "get",
        path: "/auction/item/{id}/bids/",
        tag: Tag.AUCTION,
        role: Role.STAFF,
        summary: "Gets the full bid history of an item, with names",
        parameters: itemIdParams,
        responses: {
            [StatusCode.SuccessOK]: { description: "The bids, oldest first", schema: AuctionBidHistorySchema },
            [StatusCode.ClientErrorNotFound]: notFoundResponse,
        },
    }),
    async (req, res) => {
        const item = await Models.AuctionItem.findOne({ itemId: req.params.id }).lean();
        if (!item) {
            return sendError(res, "NotFound");
        }
        const names = await displayNames(item.bids.map((bid) => bid.userId));
        const bids = item.bids.map((bid) => ({
            userId: bid.userId,
            displayName: names.get(bid.userId) ?? null,
            amount: bid.amount,
            time: toEpochSeconds(bid.time),
        }));
        return res.status(StatusCode.SuccessOK).send({ bids });
    },
);

auctionRouter.post(
    "/item/:id/pickup/",
    specification({
        method: "post",
        path: "/auction/item/{id}/pickup/",
        tag: Tag.AUCTION,
        role: Role.STAFF,
        summary: "Marks that the winner picked up the item",
        parameters: itemIdParams,
        responses: {
            [StatusCode.SuccessOK]: { description: "The item", schema: AuctionStaffItemSchema },
            [StatusCode.ClientErrorNotFound]: notFoundResponse,
            [StatusCode.ClientErrorBadRequest]: [
                { id: AuctionNoWinnerError.error, description: "No paid winner", schema: AuctionNoWinnerErrorSchema },
                {
                    id: AuctionAlreadyPickedUpError.error,
                    description: "Already picked up",
                    schema: AuctionAlreadyPickedUpErrorSchema,
                },
            ],
        },
    }),
    async (req, res) => {
        const { id: itemId } = req.params;
        const { id: staffId } = getAuthenticatedUser(req);
        console.log(`${LOG} POST /auction/item/${itemId}/pickup/ by=${staffId}`);
        const result = await markPickedUp(itemId, staffId, clock());
        if (!result.ok) {
            return sendError(res, result.error);
        }
        const names = await displayNames(result.value.highBid ? [result.value.highBid.userId] : []);
        return res.status(StatusCode.SuccessOK).send(await toStaffView(result.value, names, clock()));
    },
);

auctionRouter.get(
    "/:id/",
    specification({
        method: "get",
        path: "/auction/{id}/",
        tag: Tag.AUCTION,
        role: Role.USER,
        summary: "Gets one auction item",
        parameters: itemIdParams,
        responses: {
            [StatusCode.SuccessOK]: { description: "The item", schema: AuctionItemViewSchema },
            [StatusCode.ClientErrorNotFound]: notFoundResponse,
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);
        const item = await Models.AuctionItem.findOne({ itemId: req.params.id }).lean();
        // Attendees never see cancelled items (the list hides them too)
        if (!item || item.status === AuctionStatus.CANCELLED) {
            return sendError(res, "NotFound");
        }
        return res.status(StatusCode.SuccessOK).send(toAttendeeView(item, userId, clock()));
    },
);

auctionRouter.post(
    "/:id/bid/",
    specification({
        method: "post",
        path: "/auction/{id}/bid/",
        tag: Tag.AUCTION,
        role: Role.USER,
        summary: "Places a bid, or raises my own leading bid",
        description:
            "While your bid leads, its points are held (taken from your points). If someone outbids you, you get them back. " +
            "A bid with less than 2 minutes left moves the close time to 2 minutes after the bid.",
        parameters: itemIdParams,
        body: AuctionBidRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: { description: "The item after the bid", schema: AuctionItemViewSchema },
            [StatusCode.ClientErrorNotFound]: [
                { id: AuctionNotFoundError.error, description: "Item doesn't exist", schema: AuctionNotFoundErrorSchema },
                { id: BidNoProfileError.error, description: "No attendee profile", schema: BidNoProfileErrorSchema },
            ],
            [StatusCode.ClientErrorBadRequest]: [
                { id: BidTooLowError.error, description: "Bid is below the minimum", schema: BidTooLowErrorSchema },
                closedResponse,
                cancelledResponse,
            ],
            [StatusCode.ClientErrorPaymentRequired]: {
                description: "Not enough points",
                schema: BidInsufficientFundsErrorSchema,
            },
            [StatusCode.ClientErrorConflict]: conflictResponse,
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);
        const { id: itemId } = req.params;
        const { amount } = req.body;
        console.log(`${LOG} POST /auction/${itemId}/bid/ user=${userId} amount=${amount}`);
        const result = await placeBid(userId, itemId, amount, clock);
        if (!result.ok && result.error === "BidTooLow" && result.minimum !== undefined) {
            return res
                .status(StatusCode.ClientErrorBadRequest)
                .send({ error: BidTooLowError.error, message: BidTooLowError.message, minimum: result.minimum });
        }
        if (!result.ok) {
            return sendError(res, result.error);
        }
        return res.status(StatusCode.SuccessOK).send(toAttendeeView(result.value, userId, clock()));
    },
);

async function staffViewWithNames(item: AuctionItem): Promise<AuctionStaffItem> {
    const names = await displayNames(item.highBid ? [item.highBid.userId] : []);
    return toStaffView(item, names, clock());
}

function sendError(res: Response, error: AuctionErrorName): Response {
    const [status, body] = ERRORS[error];
    return res.status(status).send(body);
}

export default auctionRouter;
