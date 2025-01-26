import { beforeEach, describe, expect, it } from "@jest/globals";
import { AUTH_ROLE_TO_ROLES, TESTER, delAsAttendee, get, getAsAttendee, getAsStaff, putAsAttendee } from "../../common/testTools";

import { AttendeeProfile } from "../profile/profile-schemas";
import { EventFollowers, EventAttendance, Event, EventType } from "../event/event-schemas";
import { StatusCode } from "status-code-enum";
import { AuthInfo } from "../auth/auth-schemas";
import Models from "../../common/models";
import { UserAttendance, UserFollowing, UserInfo } from "./user-schemas";
import { Role } from "../auth/auth-schemas";
import { decryptQR } from "./user-lib";

const TESTER_USER = {
    userId: TESTER.id,
    name: TESTER.name,
    email: TESTER.email,
} satisfies UserInfo;

const OTHER_USER = {
    userId: "other-user",
    email: `other-user@hackillinois.org`,
    name: "Other User",
} satisfies UserInfo;

const OTHER_USER_AUTH = {
    userId: OTHER_USER.userId,
    provider: "github",
    roles: AUTH_ROLE_TO_ROLES[Role.ATTENDEE],
} satisfies AuthInfo;

const TESTER_ATTENDEE_FOLLOWING = {
    userId: TESTER.id,
    following: ["event3", "event9"],
} satisfies UserFollowing;

const TESTER_PROFILE = {
    userId: TESTER_USER.userId,
    displayName: "TestDisplayName",
    avatarUrl: "TestURL",
    discordTag: "TestTag",
    points: 0,
    foodWave: 0,
} satisfies AttendeeProfile;

const TESTER_ATTENDANCE = {
    userId: TESTER.id,
    attendance: ["event1", "event2"],
} satisfies UserAttendance;

const TEST_EVENT_FOLLOWERS = {
    eventId: "some-event",
    followers: ["user5", "user8"],
} satisfies EventFollowers;

const TEST_EVENT_ATTENDANCE = {
    eventId: "some-event",
    attendees: [],
} satisfies EventAttendance;

const TEST_EVENT = {
    eventId: "some-event",
    isStaff: false,
    name: "Example Name",
    description: "Example Description",
    startTime: 1707069600,
    endTime: 1707069900,
    eventType: EventType.WORKSHOP,
    locations: [
        {
            description: "Siebel ",
            tags: [],
            latitude: 40.113812,
            longitude: -88.224937,
        },
    ],
    isAsync: false,
    mapImageUrl: "",
    sponsor: "",
    points: 100,
    isPrivate: false,
    displayOnStaffCheckIn: false,
    isPro: false,
} satisfies Event;

// Before each test, initialize database with tester & other users
beforeEach(async () => {
    await Models.UserInfo.create(TESTER_USER);
    await Models.UserInfo.create(OTHER_USER);
    await Models.AuthInfo.create(OTHER_USER_AUTH);
    await Models.AttendeeProfile.create(TESTER_PROFILE);
    await Models.UserFollowing.create(TESTER_ATTENDEE_FOLLOWING);
    await Models.UserAttendance.create(TESTER_ATTENDANCE);
    await Models.EventFollowers.create(TEST_EVENT_FOLLOWERS);
    await Models.EventAttendance.create(TEST_EVENT_ATTENDANCE);
    await Models.Event.create(TEST_EVENT);
});

describe("GET /user/qr/", () => {
    it("generates QR code for authenticated user", async () => {
        const creationTime = Math.floor(Date.now() / 1000);
        const response = await getAsAttendee("/user/qr/").expect(StatusCode.SuccessOK);
        const responseBody = JSON.parse(response.text);

        // Verify response format
        expect(responseBody).toMatchObject({
            userId: TESTER_USER.userId,
            qrInfo: expect.stringMatching(/hackillinois:\/\/user\?qrId=[A-Za-z0-9+/=]+/),
        });

        // Decrypt the QR code
        const encryptedToken: string = responseBody.qrInfo.split("=")[1];
        const decryptedData = decryptQR(encryptedToken);

        // Verify decrypted data
        expect(decryptedData.userId).toBe(TESTER_USER.userId);
        expect(decryptedData.exp > creationTime).toBe(true);
    });
});

describe("GET /user/qr/:id/", () => {
    it("rejects non-staff users", async () => {
        const response = await getAsAttendee(`/user/qr/${TESTER_USER.userId}/`).expect(StatusCode.ClientErrorForbidden);
        expect(JSON.parse(response.text)).toMatchObject({
            error: "Forbidden",
        });
    });

    it("generates QR code for specified user (staff)", async () => {
        const response = await getAsStaff(`/user/qr/${TESTER_USER.userId}/`).expect(StatusCode.SuccessOK);
        const responseBody = JSON.parse(response.text);

        // Verify response
        expect(responseBody).toMatchObject({
            userId: TESTER_USER.userId,
            qrInfo: expect.stringMatching(/hackillinois:\/\/user\?qrId=[A-Za-z0-9+/=]+/),
        });

        // Decrypt the QR code
        const encryptedToken: string = responseBody.qrInfo.split("=")[1];
        const decryptedData = decryptQR(encryptedToken);

        // Verify decrypted data
        expect(decryptedData.userId).toBe(TESTER_USER.userId);
        expect(decryptedData.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it("generates new QR code on subsequent requests", async () => {
        // First request
        const firstResponse = await getAsStaff(`/user/qr/${TESTER_USER.userId}/`);
        const firstEncryptedToken: string = JSON.parse(firstResponse.text).qrInfo.split("=")[1];

        // Second request
        const secondResponse = await getAsStaff(`/user/qr/${TESTER_USER.userId}/`);
        const secondEncryptedToken: string = JSON.parse(secondResponse.text).qrInfo.split("=")[1];

        // Tokens should be different
        expect(firstEncryptedToken).not.toBe(secondEncryptedToken);
    });
});

describe("GET /user/", () => {
    it("gives an unauthorized error for an unauthenticated user", async () => {
        const response = await get("/user/").expect(StatusCode.ClientErrorUnauthorized);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NoToken");
    });

    it("gives an not found error for an non-existent user", async () => {
        await Models.UserInfo.deleteOne({
            userId: TESTER_USER.userId,
        });

        const response = await getAsAttendee("/user/").expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NotFound");
    });

    it("works for an attendee user", async () => {
        const response = await getAsAttendee("/user/").expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject(TESTER_USER);
    });

    it("works for an staff user", async () => {
        const response = await getAsStaff("/user/").expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject(TESTER_USER);
    });
});

describe("GET /user/:id/", () => {
    it("gives an forbidden error for a non-staff user", async () => {
        const response = await getAsAttendee(`/user/${OTHER_USER.userId}/`).expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("gives an not found error for a non-existent user", async () => {
        await Models.UserInfo.deleteOne({
            userId: OTHER_USER.userId,
        });

        const response = await getAsStaff(`/user/${OTHER_USER.userId}/`).expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NotFound");
    });

    it("works for a staff user", async () => {
        const response = await getAsStaff(`/user/${OTHER_USER.userId}/`).expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject(OTHER_USER);
    });
});

describe("GET /user/following/", () => {
    it("works for a standard attendee", async () => {
        const response = await getAsAttendee(`/user/following/`)
            .send({ userId: TESTER_ATTENDEE_FOLLOWING.userId })
            .expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject({
            userId: TESTER_ATTENDEE_FOLLOWING.userId,
            following: TESTER_ATTENDEE_FOLLOWING.following,
        });
    });

    it("works for a staff user", async () => {
        const response = await getAsStaff(`/user/following/`)
            .send({ userId: TESTER_ATTENDEE_FOLLOWING.userId })
            .expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({
            userId: TESTER_ATTENDEE_FOLLOWING.userId,
            following: TESTER_ATTENDEE_FOLLOWING.following,
        });
    });
});

describe("PUT /user/follow/:id/", () => {
    it("gives an not found error for a non-existent event", async () => {
        await Models.Event.deleteOne({
            eventId: TEST_EVENT.eventId,
        });

        const response = await putAsAttendee(`/user/follow/${TEST_EVENT.eventId}`).expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NotFound");
    });

    it("works for an event without followers", async () => {
        await Models.EventFollowers.deleteOne({
            eventId: TEST_EVENT.eventId,
        });

        const response = await putAsAttendee(`/user/follow/${TEST_EVENT.eventId}`).expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({
            userId: TESTER.id,
            following: [...TESTER_ATTENDEE_FOLLOWING.following, TEST_EVENT.eventId],
        });

        const userFollowing = await Models.UserFollowing.findOne({ userId: TESTER.id });
        expect(userFollowing?.toObject()).toMatchObject({
            userId: TESTER.id,
            following: [...TESTER_ATTENDEE_FOLLOWING.following, TEST_EVENT.eventId],
        });

        const eventFollowers = await Models.EventFollowers.findOne({ eventId: TEST_EVENT.eventId });
        expect(eventFollowers?.toObject()).toMatchObject({
            eventId: TEST_EVENT.eventId,
            followers: [TESTER.id],
        });
    });

    it("works for an attendee user", async () => {
        const response = await putAsAttendee(`/user/follow/${TEST_EVENT.eventId}`).expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject({
            userId: TESTER.id,
            following: [...TESTER_ATTENDEE_FOLLOWING.following, TEST_EVENT.eventId],
        });

        const userFollowing = await Models.UserFollowing.findOne({ userId: TESTER.id });
        expect(userFollowing?.toObject()).toMatchObject({
            userId: TESTER.id,
            following: [...TESTER_ATTENDEE_FOLLOWING.following, TEST_EVENT.eventId],
        });

        const eventFollowers = await Models.EventFollowers.findOne({ eventId: TEST_EVENT.eventId });
        expect(eventFollowers?.toObject()).toMatchObject({
            eventId: TEST_EVENT.eventId,
            followers: [...TEST_EVENT_FOLLOWERS.followers, TESTER.id],
        });
    });
});

describe("DELETE /user/unfollow/:id/", () => {
    it("gives an not found error for a non-existent event", async () => {
        await Models.Event.deleteOne({
            eventId: TEST_EVENT.eventId,
        });

        const response = await delAsAttendee(`/user/unfollow/${TEST_EVENT.eventId}`).expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NotFound");
    });

    it("works for an attendee user", async () => {
        await Models.EventFollowers.findOneAndUpdate(
            { eventId: TEST_EVENT.eventId },
            { $addToSet: { followers: TESTER_ATTENDEE_FOLLOWING.userId } },
            { new: true },
        );
        await Models.UserFollowing.findOneAndUpdate(
            { userId: TESTER_ATTENDEE_FOLLOWING.userId },
            { $addToSet: { following: TEST_EVENT.eventId } },
            { new: true },
        );

        const response = await delAsAttendee(`/user/unfollow/${TEST_EVENT.eventId}`).expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject(TESTER_ATTENDEE_FOLLOWING);

        const updatedEvents = await Models.UserFollowing.findOne({ userId: TESTER_ATTENDEE_FOLLOWING.userId });
        expect(updatedEvents).toEqual(expect.not.arrayContaining([TEST_EVENT.eventId]));

        const updatedUsers = await Models.EventFollowers.findOne({ eventId: TEST_EVENT.eventId });
        expect(updatedUsers).toEqual(expect.not.arrayContaining([TESTER_ATTENDEE_FOLLOWING.userId]));
    });
});

describe("PUT /user/scan-event/", () => {
    it("returns not found for non-existent event", async () => {
        const response = await putAsAttendee("/user/scan-event/")
            .send({ eventId: "not-a-event" })
            .expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NotFound");
    });

    it("works for an attendee without existing attendance", async () => {
        await Models.UserAttendance.deleteOne({ userId: TESTER.id });
        await putAsAttendee("/user/scan-event/").send({ eventId: TEST_EVENT.eventId }).expect(StatusCode.SuccessOK);

        const eventAttendance = await Models.EventAttendance.findOne({ eventId: TEST_EVENT.eventId });

        expect(eventAttendance?.toObject()).toMatchObject({
            eventId: TEST_EVENT.eventId,
            attendees: [...TEST_EVENT_ATTENDANCE.attendees, TESTER.id],
        });

        const userAttendance = await Models.UserAttendance.findOne({ userId: TESTER.id });
        expect(userAttendance?.toObject()).toMatchObject({
            userId: TESTER.id,
            attendance: [TEST_EVENT.eventId],
        });

        const response = await putAsAttendee("/user/scan-event/")
            .send({ eventId: TEST_EVENT.eventId })
            .expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "AlreadyCheckedIn");
    });

    it("works for an attendee and returns already checked in if already checked in", async () => {
        await putAsAttendee("/user/scan-event/").send({ eventId: TEST_EVENT.eventId }).expect(StatusCode.SuccessOK);

        const eventAttendance = await Models.EventAttendance.findOne({ eventId: TEST_EVENT.eventId });

        expect(eventAttendance?.toObject()).toMatchObject({
            eventId: TEST_EVENT.eventId,
            attendees: [...TEST_EVENT_ATTENDANCE.attendees, TESTER.id],
        });

        const userAttendance = await Models.UserAttendance.findOne({ userId: TESTER.id });
        expect(userAttendance?.toObject()).toMatchObject({
            userId: TESTER.id,
            attendance: [...TESTER_ATTENDANCE.attendance, TEST_EVENT.eventId],
        });

        const response = await putAsAttendee("/user/scan-event/")
            .send({ eventId: TEST_EVENT.eventId })
            .expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "AlreadyCheckedIn");
    });
});
