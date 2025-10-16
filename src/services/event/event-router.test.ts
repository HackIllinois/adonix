import { describe, expect, it, beforeEach } from "@jest/globals";
import { EventFollowers, EventAttendance } from "./event-schemas";
import Models from "../../common/models";
import { StatusCode } from "status-code-enum";
import { TESTER, getAsAttendee, getAsStaff, postAsAttendee, postAsStaff } from "../../common/testTools";
import { UserFollowing, UserInfo } from "../user/user-schemas";
import { EventSchema } from "./event-schemas";
import { z } from "zod";

const TESTER_EVENT_FOLLOWERS = {
    eventId: "other-event",
    followers: ["user5", "user8"],
} satisfies EventFollowers;

const TESTER_ATTENDEE_FOLLOWING = {
    userId: TESTER.id,
    following: ["event3", "event9"],
} satisfies UserFollowing;

const TESTER_EVENT_ATTENDANCE = {
    eventId: "test-event-123",
    attendees: ["user1", "user2"],
    excusedAttendees: [],
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

describe("POST /event/mark-excused/:id/", () => {
    it("gives a forbidden error for a non-staff user", async () => {
        const response = await postAsAttendee(`/event/mark-excused/${TESTER_EVENT_ATTENDANCE.eventId}/`)
            .send({ userId: "user3" })
            .expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("gives a not found error for a non-existent event", async () => {
        await Models.EventAttendance.deleteOne({
            eventId: TESTER_EVENT_ATTENDANCE.eventId,
        });

        const response = await postAsStaff(`/event/mark-excused/${TESTER_EVENT_ATTENDANCE.eventId}/`)
            .send({ userId: "user3" })
            .expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NotFound");
    });

    it("works for a staff user", async () => {
        const response = await postAsStaff(`/event/mark-excused/${TESTER_EVENT_ATTENDANCE.eventId}/`)
            .send({ userId: "user3" })
            .expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({ success: true });

        const updatedAttendance = await Models.EventAttendance.findOne({
            eventId: TESTER_EVENT_ATTENDANCE.eventId,
        });
        expect(updatedAttendance?.excusedAttendees).toContain("user3");
    });

    it("does not duplicate users in excusedAttendees", async () => {
        await postAsStaff(`/event/mark-excused/${TESTER_EVENT_ATTENDANCE.eventId}/`)
            .send({ userId: "user3" })
            .expect(StatusCode.SuccessOK);

        await postAsStaff(`/event/mark-excused/${TESTER_EVENT_ATTENDANCE.eventId}/`)
            .send({ userId: "user3" })
            .expect(StatusCode.SuccessOK);

        const updatedAttendance = await Models.EventAttendance.findOne({
            eventId: TESTER_EVENT_ATTENDANCE.eventId,
        });
        const count = updatedAttendance?.excusedAttendees?.filter((id) => id === "user3").length;
        expect(count).toBe(1);
    });
});

describe("EventSchema", () => {
    it("should validate an event with isMandatory set to true", () => {
        const validEvent = {
            eventId: "event1",
            name: "Test Event",
            description: "This is a test event",
            startTime: 1632202702,
            endTime: 1632212702,
            locations: [
                {
                    description: "Test Location",
                    latitude: 40.1138,
                    longitude: -88.2249,
                },
            ],
            eventType: "WORKSHOP",
            points: 10,
            isStaff: false,
            isPrivate: false,
            isAsync: false,
            isPro: false,
            isMandatory: true,
        };

        expect(() => EventSchema.parse(validEvent)).not.toThrow();
    });

    it("should validate an event without isMandatory (optional field)", () => {
        const validEvent = {
            eventId: "event2",
            name: "Another Test Event",
            description: "This is another test event",
            startTime: 1632202702,
            endTime: 1632212702,
            locations: [
                {
                    description: "Another Test Location",
                    latitude: 40.1138,
                    longitude: -88.2249,
                },
            ],
            eventType: "MEETING",
            points: 5,
            isStaff: false,
            isPrivate: false,
            isAsync: false,
            isPro: false,
        };

        expect(() => EventSchema.parse(validEvent)).not.toThrow();
    });

    it("should throw an error for an invalid isMandatory value", () => {
        const invalidEvent = {
            eventId: "event3",
            name: "Invalid Event",
            description: "This event has an invalid isMandatory value",
            startTime: 1632202702,
            endTime: 1632212702,
            locations: [
                {
                    description: "Invalid Location",
                    latitude: 40.1138,
                    longitude: -88.2249,
                },
            ],
            eventType: "QNA",
            points: 0,
            isStaff: false,
            isPrivate: false,
            isAsync: false,
            isPro: false,
            isMandatory: "not-a-boolean",
        };

        expect(() => EventSchema.parse(invalidEvent)).toThrow(z.ZodError);
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
