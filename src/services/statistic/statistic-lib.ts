import Config from "../../common/config";
import Models from "../../common/models";
import { DecisionResponse, DecisionStatus } from "../admission/admission-schemas";
import { DecisionStatistic, EventStatistic, RSVPStatistic, ShopItemStatistic } from "./statistic-schemas";

export async function log(timestamp: number): Promise<void> {
    const [eventAttendances, decisions, items, history] = await Promise.all([
        Models.EventAttendance.find(),
        Models.AdmissionDecision.find(),
        Models.ShopItem.find(),
        Models.ShopHistory.find(),
    ]);
    const events: EventStatistic[] = eventAttendances.map(({ eventId, attendees }) => ({
        eventId,
        attendees: attendees.length,
    }));
    const decision: DecisionStatistic = {
        accepted: decisions.filter((decision) => decision.status === DecisionStatus.ACCEPTED).length,
        rejected: decisions.filter((decision) => decision.status === DecisionStatus.REJECTED).length,
        waitlisted: decisions.filter((decision) => decision.status === DecisionStatus.WAITLISTED).length,
        tbd: decisions.filter((decision) => decision.status === DecisionStatus.TBD).length,
    };
    const rsvp: RSVPStatistic = {
        accepted: decisions.filter(
            (decision) => decision.status === DecisionStatus.ACCEPTED && decision.response === DecisionResponse.ACCEPTED,
        ).length,
        declined: decisions.filter(
            (decision) => decision.status === DecisionStatus.ACCEPTED && decision.response === DecisionResponse.DECLINED,
        ).length,
        pending: decisions.filter(
            (decision) => decision.status === DecisionStatus.ACCEPTED && decision.response === DecisionResponse.PENDING,
        ).length,
    };
    const shopItems: ShopItemStatistic[] = items.map(({ itemId }) => ({
        itemId,
        purchased: history.reduce((count, order) => (order.items.get(itemId) ?? 0) + count, 0),
    }));
    await Models.StatisticLog.findOneAndUpdate(
        { timestamp },
        {
            events,
            decision,
            rsvp,
            shopItems,
        },
        {
            upsert: true,
        },
    );
}

function calculateNextRunTime(): Date {
    const now = new Date();
    const minutes = now.getMinutes();

    // Find the next run minutes
    const nextRunMinutes =
        Math.floor((minutes + Config.STATISTIC_LOG_INTERNAL_MINUTES) / Config.STATISTIC_LOG_INTERNAL_MINUTES) *
        Config.STATISTIC_LOG_INTERNAL_MINUTES;

    // Calculate the time difference
    const nextRunTime = new Date(now);
    nextRunTime.setMinutes(nextRunMinutes);
    nextRunTime.setSeconds(0); // Reset seconds to 0 for accuracy
    nextRunTime.setMilliseconds(0);

    // Return the next time to run
    return nextRunTime;
}

function logEvery(): void {
    const next = calculateNextRunTime();
    const delay = next.getTime() - Date.now();
    setTimeout(async () => {
        await log(Math.floor(next.getTime() / Config.MILLISECONDS_PER_SECOND));
        logEvery();
    }, delay);
}

export function initializeStatisticLogging(): void {
    logEvery();
}
