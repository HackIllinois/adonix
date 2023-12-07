import { describe, expect, it, beforeEach } from "@jest/globals";
import { EventFollowers } from "database/event-db.js";
import { AttendeeFollowing } from "database/attendee-db.js";
import Models from "../../database/models.js";
import { StatusCode } from "status-code-enum";
import { TESTER, getAsAttendee, getAsStaff } from "../../testTools.js";

const TESTER_EVENT_FOLLOWING = {
    eventId: "other-event",
    followers: ["user5", "user8"],
} satisfies EventFollowers;

const TESTER_ATTENDEE_FOLLOWING = {
    userId: TESTER.id,
    events: ["event3", "event9"],
} satisfies AttendeeFollowing;

// Before each test, initialize database with tester & other users
beforeEach(async () => {
    Models.initialize();
    await Models.EventFollowing.create(TESTER_EVENT_FOLLOWING);
    await Models.AttendeeFollowing.create(TESTER_ATTENDEE_FOLLOWING);
});

describe("GET /event/followers/:EVENTID", () => {
    it("gives an forbidden error for a non-staff user", async () => {
        const response = await getAsAttendee(`/event/followers/${TESTER_EVENT_FOLLOWING.eventId}/`).expect(
            StatusCode.ClientErrorForbidden,
        );

        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("gives an not found error for a non-existent event", async () => {
        await Models.EventFollowing.deleteOne({
            eventId: TESTER_EVENT_FOLLOWING.eventId,
        });

        const response = await getAsStaff(`/event/followers/${TESTER_EVENT_FOLLOWING.eventId}/`).expect(
            StatusCode.ClientErrorNotFound,
        );

        expect(JSON.parse(response.text)).toHaveProperty("error", "EventNotFound");
    });

    it("works for a staff user", async () => {
        const response = await getAsStaff(`/event/followers/${TESTER_EVENT_FOLLOWING.eventId}/`).expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toEqual(TESTER_EVENT_FOLLOWING.followers);
    });
});
