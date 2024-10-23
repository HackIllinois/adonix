import { describe, expect, it, beforeEach } from "@jest/globals";
import { EventFollowers } from "./event-schemas";
import { AttendeeFollowing } from "../../database/attendee-db";
import Models from "../../database/models";
import { StatusCode } from "status-code-enum";
import { TESTER, getAsAttendee, getAsStaff } from "../../common/testTools";

const TESTER_EVENT_FOLLOWERS = {
    eventId: "other-event",
    followers: ["user5", "user8"],
} satisfies EventFollowers;

const TESTER_ATTENDEE_FOLLOWING = {
    userId: TESTER.id,
    following: ["event3", "event9"],
} satisfies AttendeeFollowing;

// Before each test, initialize database with tester & other users
beforeEach(async () => {
    await Models.EventFollowers.create(TESTER_EVENT_FOLLOWERS);
    await Models.AttendeeFollowing.create(TESTER_ATTENDEE_FOLLOWING);
});

describe("GET /event/followers/", () => {
    it("gives an forbidden error for a non-staff user", async () => {
        const response = await getAsAttendee(`/event/followers/${TESTER_EVENT_FOLLOWERS.eventId}/`).expect(
            StatusCode.ClientErrorForbidden,
        );

        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("gives an not found error for a non-existent event", async () => {
        await Models.EventFollowers.deleteOne({
            eventId: TESTER_EVENT_FOLLOWERS.eventId,
        });

        const response = await getAsStaff(`/event/followers/${TESTER_EVENT_FOLLOWERS.eventId}/`).expect(
            StatusCode.ClientErrorNotFound,
        );

        expect(JSON.parse(response.text)).toHaveProperty("error", "NotFound");
    });

    it("works for a staff user", async () => {
        const response = await getAsStaff(`/event/followers/${TESTER_EVENT_FOLLOWERS.eventId}/`).expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({
            eventId: TESTER_EVENT_FOLLOWERS.eventId,
            followers: TESTER_EVENT_FOLLOWERS.followers,
        });
    });
});
