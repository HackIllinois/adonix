import { describe, expect, it, beforeEach } from "@jest/globals";
import { EventFollowers, EventAttendance } from "./event-schemas";
import Models from "../../common/models";
import { StatusCode } from "status-code-enum";
import { TESTER, getAsAttendee, getAsStaff } from "../../common/testTools";
import { UserFollowing, UserInfo } from "../user/user-schemas";

const TESTER_EVENT_FOLLOWERS = {
    eventId: "other-event",
    followers: ["user5", "user8"],
} satisfies EventFollowers;

const TESTER_ATTENDEE_FOLLOWING = {
    userId: TESTER.id,
    following: ["event3", "event9"],
} satisfies UserFollowing;

const TESTER_EVENT_ATTENDANCE = {
    eventId: "attendees-event",
    attendees: ["user1", "user2"],
} satisfies EventAttendance;

const TESTER_USER_INFO_1 = {
    userId: "user1",
    name: "John Doe1",
    email: "john@example.com",
} satisfies UserInfo;

const TESTER_USER_INFO_2 = {
    userId: "user2",
    name: "John Doe2",
    email: "john@example.com",
} satisfies UserInfo;

// Before each test, initialize database with tester & other users
beforeEach(async () => {
    await Models.EventFollowers.create(TESTER_EVENT_FOLLOWERS);
    await Models.UserFollowing.create(TESTER_ATTENDEE_FOLLOWING);
    await Models.EventAttendance.create(TESTER_EVENT_ATTENDANCE);
    await Models.UserInfo.create(TESTER_USER_INFO_1);
    await Models.UserInfo.create(TESTER_USER_INFO_2);
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

describe("GET /event/attendees-info/", () => {
    it("works for a staff user and returns attendee information", async () => {
        const response = await getAsStaff(`/event/attendees-info/${TESTER_EVENT_ATTENDANCE.eventId}/`).expect(
            StatusCode.SuccessOK,
        );

        expect(JSON.parse(response.text)).toMatchObject({
            eventId: TESTER_EVENT_ATTENDANCE.eventId,
            attendeesInfo: [
                { userId: "user1", name: "John Doe1", email: "john@example.com" },
                { userId: "user2", name: "John Doe2", email: "john@example.com" },
            ],
        });
    });
});
