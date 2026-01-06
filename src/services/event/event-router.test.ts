import { describe, expect, it, beforeEach } from "@jest/globals";
import { EventFollowers, EventAttendance, EventType, Event } from "./event-schemas";
import Models from "../../common/models";
import { StatusCode } from "status-code-enum";
import { TESTER, getAsAttendee, getAsStaff, putAsAttendee, putAsStaff } from "../../common/testTools";
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

const TESTER_EVENT_ATTENDANCE_1 = {
    eventId: "test-event-1",
    attendees: ["user1", "user2"],
    excusedAttendees: ["user3"],
} satisfies EventAttendance;

const TESTER_EVENT_ATTENDANCE_2 = {
    eventId: "test-event-2",
    attendees: ["user1", "user3"],
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

const TESTER_USER_INFO_3 = {
    userId: "user3",
    name: "John Doe3",
    email: "john@example.com",
} satisfies UserInfo;

const TESTER_EVENT_1 = {
    eventId: "test-event-1",
    isStaff: true,
    name: "meeting",
    description: "first meeting",
    startTime: 10,
    endTime: 12,
    eventType: EventType.MEETING,
    locations: [],
    isAsync: false,
    points: 0,
    isPrivate: true,
    isMandatory: true,
    isPro: false,
} satisfies Event;

const TESTER_EVENT_2 = {
    eventId: "test-event-2",
    isStaff: true,
    name: "meeting",
    description: "second meeting",
    startTime: 9,
    endTime: 10,
    eventType: EventType.MEETING,
    locations: [],
    isAsync: false,
    points: 0,
    isPrivate: true,
    isMandatory: true,
    isPro: false,
} satisfies Event;

// Before each test, initialize database with tester & other users
beforeEach(async () => {
    await Models.EventFollowers.create(TESTER_EVENT_FOLLOWERS);
    await Models.UserFollowing.create(TESTER_ATTENDEE_FOLLOWING);
    await Models.EventAttendance.create(TESTER_EVENT_ATTENDANCE_1);
    await Models.EventAttendance.create(TESTER_EVENT_ATTENDANCE_2);
    await Models.UserInfo.create(TESTER_USER_INFO_1);
    await Models.UserInfo.create(TESTER_USER_INFO_2);
    await Models.UserInfo.create(TESTER_USER_INFO_3);
    await Models.Event.create(TESTER_EVENT_1);
    await Models.Event.create(TESTER_EVENT_2);
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

describe("PUT /event/mark-excused/:id/", () => {
    it("gives a forbidden error for a non-staff user", async () => {
        const response = await putAsAttendee(`/event/mark-excused/${TESTER_EVENT_ATTENDANCE_1.eventId}/`)
            .send({ userId: "user3", excused: true })
            .expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("gives a not found error for a non-existent event", async () => {
        await Models.EventAttendance.deleteOne({
            eventId: TESTER_EVENT_ATTENDANCE_1.eventId,
        });

        const response = await putAsStaff(`/event/mark-excused/${TESTER_EVENT_ATTENDANCE_1.eventId}/`)
            .send({ userId: "user3", excused: true })
            .expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NotFound");
    });

    it("marks staff user as excused", async () => {
        const response = await putAsStaff(`/event/mark-excused/${TESTER_EVENT_ATTENDANCE_1.eventId}/`)
            .send({ userId: "user3", excused: true })
            .expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({ success: true });

        const updatedAttendance = await Models.EventAttendance.findOne({
            eventId: TESTER_EVENT_ATTENDANCE_1.eventId,
        });
        expect(updatedAttendance?.excusedAttendees).toContain("user3");
    });

    it("unmarks staff user as excused", async () => {
        const response = await putAsStaff(`/event/mark-excused/${TESTER_EVENT_ATTENDANCE_1.eventId}/`)
            .send({ userId: "user3", excused: false })
            .expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({ success: true });

        const updatedAttendance = await Models.EventAttendance.findOne({
            eventId: TESTER_EVENT_ATTENDANCE_1.eventId,
        });
        expect(updatedAttendance?.excusedAttendees).not.toContain("user3");
    });

    it("does not duplicate users in excusedAttendees", async () => {
        await putAsStaff(`/event/mark-excused/${TESTER_EVENT_ATTENDANCE_1.eventId}/`)
            .send({ userId: "user3", excused: true })
            .expect(StatusCode.SuccessOK);

        await putAsStaff(`/event/mark-excused/${TESTER_EVENT_ATTENDANCE_1.eventId}/`)
            .send({ userId: "user3", excused: true })
            .expect(StatusCode.SuccessOK);

        const updatedAttendance = await Models.EventAttendance.findOne({
            eventId: TESTER_EVENT_ATTENDANCE_1.eventId,
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
        const response = await getAsStaff(`/event/attendees-info/${TESTER_EVENT_ATTENDANCE_1.eventId}/`).expect(
            StatusCode.SuccessOK,
        );

        expect(JSON.parse(response.text)).toMatchObject({
            eventId: TESTER_EVENT_ATTENDANCE_1.eventId,
            attendeesInfo: [
                { userId: "user1", name: "John Doe1", email: "john@example.com" },
                { userId: "user2", name: "John Doe2", email: "john@example.com" },
            ],
        });
    });
});

describe("GET /event/attendance/:id/", () => {
    it("returns events user is present for", async () => {
        const response = await getAsStaff(`/event/attendance/${TESTER_USER_INFO_1.userId}/`).expect(StatusCode.SuccessOK);

        const data = JSON.parse(response.text);
        expect(data.present).toContainEqual([TESTER_EVENT_1.eventId, TESTER_EVENT_1.startTime, TESTER_EVENT_1.endTime]);
        expect(data.present).toContainEqual([TESTER_EVENT_2.eventId, TESTER_EVENT_2.startTime, TESTER_EVENT_2.endTime]);
    });

    it("returns events user is present and excused for", async () => {
        const response = await getAsStaff(`/event/attendance/${TESTER_USER_INFO_3.userId}/`).expect(StatusCode.SuccessOK);

        const data = JSON.parse(response.text);
        expect(data.excused).toContainEqual([TESTER_EVENT_1.eventId, TESTER_EVENT_1.startTime, TESTER_EVENT_1.endTime]);
        expect(data.present).toContainEqual([TESTER_EVENT_2.eventId, TESTER_EVENT_2.startTime, TESTER_EVENT_2.endTime]);
    });

    it("returns events user is present and absent for", async () => {
        const response = await getAsStaff(`/event/attendance/${TESTER_USER_INFO_2.userId}/`).expect(StatusCode.SuccessOK);

        const data = JSON.parse(response.text);
        expect(data.present).toContainEqual([TESTER_EVENT_1.eventId, TESTER_EVENT_1.startTime, TESTER_EVENT_1.endTime]);
        expect(data.absent).toContainEqual([TESTER_EVENT_2.eventId, TESTER_EVENT_2.startTime, TESTER_EVENT_2.endTime]);
    });
});

describe("PUT /event/update-attendance/:id/", () => {
    it("gives a forbidden error for a non-staff user", async () => {
        const response = await putAsAttendee(`/event/update-attendance/${TESTER_EVENT_ATTENDANCE_1.eventId}/`)
            .send({ userId: "user3", present: true })
            .expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("gives a not found error for a non-existent event", async () => {
        await Models.EventAttendance.deleteOne({
            eventId: TESTER_EVENT_ATTENDANCE_1.eventId,
        });

        const response = await putAsStaff(`/event/update-attendance/${TESTER_EVENT_ATTENDANCE_1.eventId}/`)
            .send({ userId: "user3", present: true })
            .expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NotFound");
    });

    it("updates staff user as present", async () => {
        const response = await putAsStaff(`/event/update-attendance/${TESTER_EVENT_ATTENDANCE_1.eventId}/`)
            .send({ userId: "user3", present: true })
            .expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({ success: true });

        const updatedAttendance = await Models.EventAttendance.findOne({
            eventId: TESTER_EVENT_ATTENDANCE_1.eventId,
        });
        expect(updatedAttendance?.attendees).toContain("user3");
    });

    it("updates staff user as absent", async () => {
        const response = await putAsStaff(`/event/update-attendance/${TESTER_EVENT_ATTENDANCE_1.eventId}/`)
            .send({ userId: "user3", present: false })
            .expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({ success: true });

        const updatedAttendance = await Models.EventAttendance.findOne({
            eventId: TESTER_EVENT_ATTENDANCE_1.eventId,
        });
        expect(updatedAttendance?.attendees).not.toContain("user3");
    });

    it("does not duplicate users in attendees", async () => {
        await putAsStaff(`/event/update-attendance/${TESTER_EVENT_ATTENDANCE_1.eventId}/`)
            .send({ userId: "user3", present: true })
            .expect(StatusCode.SuccessOK);

        await putAsStaff(`/event/update-attendance/${TESTER_EVENT_ATTENDANCE_1.eventId}/`)
            .send({ userId: "user3", present: true })
            .expect(StatusCode.SuccessOK);

        const updatedAttendance = await Models.EventAttendance.findOne({
            eventId: TESTER_EVENT_ATTENDANCE_1.eventId,
        });
        const count = updatedAttendance?.attendees?.filter((id) => id === "user3").length;
        expect(count).toBe(1);
    });
});
