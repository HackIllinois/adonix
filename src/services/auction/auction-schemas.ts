import { modelOptions, prop } from "@typegoose/typegoose";
import { z } from "zod";
import { CreateErrorAndSchema, UserIdSchema } from "../../common/schemas";

export enum AuctionStatus {
    OPEN = "OPEN",
    CLOSED = "CLOSED",
    CANCELLED = "CANCELLED",
}

export const MAX_AUCTION_AMOUNT = 1_000_000;

@modelOptions({ schemaOptions: { _id: false } })
export class AuctionBid {
    @prop({ required: true })
    public userId: string;

    @prop({ required: true })
    public amount: number;

    @prop({ required: true })
    public bidId: string;

    @prop({ required: true })
    public time: Date;
}

@modelOptions({ schemaOptions: { _id: false } })
export class AuctionPickup {
    @prop({ required: true })
    public by: string;

    @prop({ required: true })
    public at: Date;
}

// Points held for (or spent on) one auction item, stored on the attendee profile
@modelOptions({ schemaOptions: { _id: false } })
export class AuctionHold {
    @prop({ required: true })
    public itemId: string;

    @prop({ required: true })
    public bidId: string;

    @prop({ required: true })
    public amount: number;

    @prop({ required: true })
    public at: Date;
}

export class AuctionItem {
    @prop({ required: true, unique: true })
    public itemId: string;

    @prop({ required: true })
    public name: string;

    @prop({ required: true })
    public description: string;

    @prop({ required: true })
    public imageURL: string;

    @prop({ required: true })
    public startPrice: number;

    @prop({ required: true })
    public step: number;

    @prop({ required: true, index: true })
    public closeTime: Date;

    @prop({ required: true })
    public originalCloseTime: Date;

    @prop({ required: true, enum: AuctionStatus, type: String, index: true })
    public status: AuctionStatus;

    @prop({ required: false, type: () => AuctionBid, default: null })
    public highBid: AuctionBid | null;

    @prop({ required: true, type: () => [AuctionBid], default: [] })
    public bids: AuctionBid[];

    // Goes up on every change, every write checks it
    @prop({ required: true, default: 0 })
    public version: number;

    @prop({ required: true, default: 0 })
    public bidCount: number;

    @prop({ required: true, default: false })
    public winnerPushClaimed: boolean;

    @prop({ required: true, default: false })
    public needsReview: boolean;

    @prop({ required: false, type: () => AuctionPickup, default: null })
    public pickedUp: AuctionPickup | null;
}

const EpochSecondsSchema = z.number().int().openapi({ example: 1772334000 });
const AmountSchema = z.number().int().min(1).max(MAX_AUCTION_AMOUNT);

export const AuctionItemIdSchema = z.string().openapi("AuctionItemId", { example: "3e7eea9a-7264-4ddf-877d-9e004a888eda" });
export const AuctionStatusSchema = z.nativeEnum(AuctionStatus).openapi("AuctionStatus");

export const AuctionItemCreateRequestSchema = z
    .object({
        name: z.string().min(1),
        description: z.string(),
        imageURL: z.string(),
        startPrice: AmountSchema,
        step: AmountSchema,
        closeTime: EpochSecondsSchema,
    })
    .openapi("AuctionItemCreateRequest", {
        example: {
            name: "Signed Hoodie",
            description: "One of a kind",
            imageURL: "https://example.com/hoodie.png",
            startPrice: 50,
            step: 5,
            closeTime: 1772334000,
        },
    });
export type AuctionItemCreateRequest = z.infer<typeof AuctionItemCreateRequestSchema>;

export const AuctionItemUpdateRequestSchema = AuctionItemCreateRequestSchema.partial().openapi("AuctionItemUpdateRequest");
export type AuctionItemUpdateRequest = z.infer<typeof AuctionItemUpdateRequestSchema>;

export const AuctionReopenRequestSchema = z
    .object({ closeTime: EpochSecondsSchema })
    .openapi("AuctionReopenRequest", { example: { closeTime: 1772334000 } });

export const AuctionBidRequestSchema = z
    .object({ amount: AmountSchema })
    .openapi("AuctionBidRequest", { example: { amount: 60 } });

export const AuctionItemViewSchema = z
    .object({
        itemId: AuctionItemIdSchema,
        name: z.string(),
        description: z.string(),
        imageURL: z.string(),
        startPrice: z.number(),
        step: z.number(),
        closeTime: EpochSecondsSchema,
        originalCloseTime: EpochSecondsSchema,
        status: AuctionStatusSchema,
        highBid: z.number().nullable(),
        nextMinimum: z.number(),
        bidCount: z.number(),
        youLead: z.boolean(),
    })
    .openapi("AuctionItemView", {
        description: "Attendee view. Contains no names or user ids.",
    });
export type AuctionItemView = z.infer<typeof AuctionItemViewSchema>;

export const AuctionItemsViewSchema = z.object({ items: z.array(AuctionItemViewSchema) }).openapi("AuctionItemsView");

export const AuctionMeViewSchema = z
    .object({
        leading: z.array(AuctionItemViewSchema),
        won: z.array(AuctionItemViewSchema.extend({ paid: z.number() })),
    })
    .openapi("AuctionMeView");

export const AuctionStaffBidSchema = z.object({
    userId: UserIdSchema,
    displayName: z.string().nullable(),
    amount: z.number(),
    time: EpochSecondsSchema,
});

export const AuctionStaffItemSchema = AuctionItemViewSchema.omit({ youLead: true })
    .extend({
        highBid: AuctionStaffBidSchema.nullable(),
        winnerPaid: z.boolean(),
        needsReview: z.boolean(),
        pickedUp: z.object({ by: UserIdSchema, at: EpochSecondsSchema }).nullable(),
    })
    .openapi("AuctionStaffItem");
export type AuctionStaffItem = z.infer<typeof AuctionStaffItemSchema>;

export const AuctionResultsSchema = z.object({ items: z.array(AuctionStaffItemSchema) }).openapi("AuctionResults");
export const AuctionBidHistorySchema = z.object({ bids: z.array(AuctionStaffBidSchema) }).openapi("AuctionBidHistory");

export const [AuctionNotFoundError, AuctionNotFoundErrorSchema] = CreateErrorAndSchema({
    error: "NotFound",
    message: "Couldn't find that auction item",
});

export const [AuctionClosedError, AuctionClosedErrorSchema] = CreateErrorAndSchema({
    error: "AuctionClosed",
    message: "This auction is closed",
});

export const [AuctionCancelledError, AuctionCancelledErrorSchema] = CreateErrorAndSchema({
    error: "AuctionCancelled",
    message: "This auction was cancelled",
});

export const [BidTooLowError] = CreateErrorAndSchema({
    error: "BidTooLow",
    message: "Your bid is below the minimum bid",
});
// Like the other errors, plus the lowest bid that would be accepted now
export const BidTooLowErrorSchema = z
    .object({
        error: z.literal(BidTooLowError.error),
        message: z.literal(BidTooLowError.message),
        minimum: z.number().int(),
    })
    .openapi({ example: { error: BidTooLowError.error, message: BidTooLowError.message, minimum: 65 } });

export const [BidInsufficientFundsError, BidInsufficientFundsErrorSchema] = CreateErrorAndSchema({
    error: "InsufficientFunds",
    message: "You don't have enough points for that bid",
});

export const [BidNoProfileError, BidNoProfileErrorSchema] = CreateErrorAndSchema({
    error: "NoProfile",
    message: "You need an attendee profile to bid",
});

export const [BidConflictError, BidConflictErrorSchema] = CreateErrorAndSchema({
    error: "BidConflict",
    message: "Another change happened at the same time, try again",
});

export const [AuctionHasBidsError, AuctionHasBidsErrorSchema] = CreateErrorAndSchema({
    error: "HasBids",
    message: "This item has bids, so it can only be cancelled",
});

export const [AuctionInvalidCloseTimeError, AuctionInvalidCloseTimeErrorSchema] = CreateErrorAndSchema({
    error: "InvalidCloseTime",
    message: "The close time must be in the future",
});

export const [AuctionNotUnsoldError, AuctionNotUnsoldErrorSchema] = CreateErrorAndSchema({
    error: "NotUnsold",
    message: "Only a closed item with no bids can be reopened",
});

export const [AuctionNoWinnerError, AuctionNoWinnerErrorSchema] = CreateErrorAndSchema({
    error: "NoWinner",
    message: "This item has no paid winner",
});

export const [AuctionAlreadyPickedUpError, AuctionAlreadyPickedUpErrorSchema] = CreateErrorAndSchema({
    error: "AlreadyPickedUp",
    message: "This item was already picked up",
});
