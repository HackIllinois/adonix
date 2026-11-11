import Config from "../../common/config";
import Models from "../../common/models";
import { AuctionItem, AuctionItemView, AuctionStaffItem } from "./auction-schemas";
import { effectiveStatus, isWinnerPaid, nextMinimum } from "./auction-lib";

// Epoch seconds, rounded up, so a client never sees a close time earlier than the real one
export function toEpochSeconds(date: Date): number {
    return Math.ceil(date.getTime() / Config.MILLISECONDS_PER_SECOND);
}

// Attendee view: no names, no user ids, no bid ids
export function toAttendeeView(item: AuctionItem, viewerId: string, now: Date): AuctionItemView {
    return {
        itemId: item.itemId,
        name: item.name,
        description: item.description,
        imageURL: item.imageURL,
        startPrice: item.startPrice,
        step: item.step,
        closeTime: toEpochSeconds(item.closeTime),
        originalCloseTime: toEpochSeconds(item.originalCloseTime),
        status: effectiveStatus(item, now),
        highBid: item.highBid?.amount ?? null,
        nextMinimum: nextMinimum(item),
        bidCount: item.bidCount,
        youLead: item.highBid?.userId === viewerId,
    };
}

export async function displayNames(userIds: string[]): Promise<Map<string, string>> {
    const profiles = await Models.AttendeeProfile.find(
        { userId: { $in: [...new Set(userIds)] } },
        { userId: 1, displayName: 1 },
    ).lean();
    return new Map(profiles.map((profile) => [profile.userId, profile.displayName]));
}

export async function toStaffView(item: AuctionItem, names: Map<string, string>, now: Date): Promise<AuctionStaffItem> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { youLead, ...base } = toAttendeeView(item, "", now);
    return {
        ...base,
        highBid: item.highBid
            ? {
                  userId: item.highBid.userId,
                  displayName: names.get(item.highBid.userId) ?? null,
                  amount: item.highBid.amount,
                  time: toEpochSeconds(item.highBid.time),
              }
            : null,
        winnerPaid: await isWinnerPaid(item),
        needsReview: item.needsReview,
        pickedUp: item.pickedUp ? { by: item.pickedUp.by, at: toEpochSeconds(item.pickedUp.at) } : null,
    };
}
