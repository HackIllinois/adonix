import { beforeEach, afterEach, describe, expect, it } from "@jest/globals";
import { AUTH_ROLE_TO_ROLES, TESTER, get, getAsAdmin, getAsAttendee, getAsStaff, putAsAttendee } from "../../testTools.js";

import { AttendeeFollowing } from "database/attendee-db.js";
import { EventFollowers } from "database/event-db.js";
import { StatusCode } from "status-code-enum";
import Config from "../../config.js";
import { AuthInfo } from "../../database/auth-db.js";
import Models from "../../database/models.js";
import { UserInfo } from "../../database/user-db.js";
import { Role } from "../auth/auth-models.js";
import { mockGenerateJwtTokenWithWrapper } from "../auth/mocks/auth.js";
// import { afterEach } from "node:test";
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

const TESTER_EVENT_FOLLOWING = {
    eventId: "other-event",
    followers: ["user5", "user8"],
} satisfies EventFollowers;

const TESTER_ATTENDEE_FOLLOWING = {
    userId: TESTER.id,
    following: ["event3", "event9"],
} satisfies AttendeeFollowing;

// Before each test, initialize database with tester & other users
beforeEach(async () => {
    await Models.UserInfo.create(TESTER_USER);
    await Models.UserInfo.create(OTHER_USER);
    await Models.AuthInfo.create(OTHER_USER_AUTH);
    await Models.EventFollowers.create(TESTER_EVENT_FOLLOWING);
    await Models.AttendeeFollowing.create(TESTER_ATTENDEE_FOLLOWING);
});

describe("GET /user/qr/", () => {
    it("works for a attendee", async () => {
        const mockedGenerateJwtToken = mockGenerateJwtTokenWithWrapper();

        const response = await getAsAttendee("/user/qr/").expect(StatusCode.SuccessOK);

        const jwtReturned = mockedGenerateJwtToken.mock.results[mockedGenerateJwtToken.mock.results.length - 1]!.value;

        expect(JSON.parse(response.text)).toMatchObject({
            userId: TESTER_USER.userId,
            qrInfo: `hackillinois://user?userToken=${jwtReturned}`,
        });

        expect(mockedGenerateJwtToken).toBeCalledWith(
            expect.objectContaining({
                id: TESTER_USER.userId,
            }),
            false,
            Config.QR_EXPIRY_TIME,
        );
    });
});

describe("GET /user/qr/:USERID/", () => {
    it("gives a forbidden error for a non-staff user", async () => {
        const response = await getAsAttendee(`/user/qr/${OTHER_USER.userId}/`).expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("works for a non-staff user requesting their qr code", async () => {
        const mockedGenerateJwtToken = mockGenerateJwtTokenWithWrapper();

        const response = await getAsAttendee(`/user/qr/${TESTER_USER.userId}/`).expect(StatusCode.SuccessOK);

        const jwtReturned = mockedGenerateJwtToken.mock.results[mockedGenerateJwtToken.mock.results.length - 1]!.value;

        expect(JSON.parse(response.text)).toMatchObject({
            userId: TESTER_USER.userId,
            qrInfo: `hackillinois://user?userToken=${jwtReturned}`,
        });

        expect(mockedGenerateJwtToken).toBeCalledWith(
            expect.objectContaining({
                id: TESTER_USER.userId,
            }),
            false,
            Config.QR_EXPIRY_TIME,
        );
    });

    it("works for a staff user", async () => {
        const mockedGenerateJwtToken = mockGenerateJwtTokenWithWrapper();

        const response = await getAsStaff(`/user/qr/${OTHER_USER.userId}/`).expect(StatusCode.SuccessOK);

        const jwtReturned = mockedGenerateJwtToken.mock.results[mockedGenerateJwtToken.mock.results.length - 1]!.value;

        expect(JSON.parse(response.text)).toMatchObject({
            userId: OTHER_USER.userId,
            qrInfo: `hackillinois://user?userToken=${jwtReturned}`,
        });

        expect(mockedGenerateJwtToken).toBeCalledWith(
            expect.objectContaining({
                id: OTHER_USER.userId,
            }),
            false,
            Config.QR_EXPIRY_TIME,
        );
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

        expect(JSON.parse(response.text)).toHaveProperty("error", "UserNotFound");
    });

    it("works for an attendee user", async () => {
        const response = await getAsAttendee("/user/").expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject(TESTER_USER);
    });

    it("works for an staff user", async () => {
        const response = await getAsStaff("/user/").expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject(TESTER_USER);
    });

    it("works for an admin user", async () => {
        const response = await getAsAdmin("/user/").expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject(TESTER_USER);
    });
});

describe("GET /user/:USERID/", () => {
    it("gives an forbidden error for a non-staff user", async () => {
        const response = await getAsAttendee(`/user/${OTHER_USER.userId}/`).expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("gives an not found error for a non-existent user", async () => {
        await Models.UserInfo.deleteOne({
            userId: OTHER_USER.userId,
        });

        const response = await getAsStaff(`/user/${OTHER_USER.userId}/`).expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "UserNotFound");
    });

    it("works for a non-staff user requesting themselves", async () => {
        const response = await getAsAttendee(`/user/${TESTER_USER.userId}/`).expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject(TESTER_USER);
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
            events: TESTER_ATTENDEE_FOLLOWING.following,
        });
    });

    it("gives an not found error for a non-existent user", async () => {
        await Models.AttendeeFollowing.deleteOne({
            userId: TESTER_ATTENDEE_FOLLOWING.userId,
        });

        await Models.UserInfo.deleteOne({
            userId: TESTER_ATTENDEE_FOLLOWING.userId,
        });

        const response = await getAsStaff(`/user/following/`)
            .send({ userId: TESTER_ATTENDEE_FOLLOWING.userId })
            .expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "UserNotFound");
    });

    it("works for a staff user", async () => {
        const response = await getAsStaff(`/user/following/`)
            .send({ userId: TESTER_ATTENDEE_FOLLOWING.userId })
            .expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({
            userId: TESTER_ATTENDEE_FOLLOWING.userId,
            events: TESTER_ATTENDEE_FOLLOWING.following,
        });
    });

    it("gives an forbidden for a indirection operation without staff perms", async () => {
        const response = await getAsAttendee(`/user/following/`)
            .send({ userId: OTHER_USER.userId })
            .expect(StatusCode.ClientErrorForbidden);
        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("throws an error for no userId passed in", async () => {
        const response = await getAsAttendee(`/user/following/`).expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "BadRequest");
    });
});

describe("PUT /user/follow/", () => {
    beforeEach(() => {
        TESTER_ATTENDEE_FOLLOWING.following.push(TESTER_EVENT_FOLLOWING.eventId);
    });

    afterEach(() => {
        TESTER_ATTENDEE_FOLLOWING.following.pop();
    });

    it("gives an not found error for a non-existent event", async () => {
        await Models.EventFollowers.deleteOne({
            eventId: TESTER_EVENT_FOLLOWING.eventId,
        });

        const response = await putAsAttendee(`/user/follow/`)
            .send({ eventId: TESTER_EVENT_FOLLOWING.eventId })
            .expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "EventNotFound");
    });

    it("works for an attendee user", async () => {
        const response = await putAsAttendee(`/user/follow/`)
            .send({ eventId: TESTER_EVENT_FOLLOWING.eventId })
            .expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject(TESTER_ATTENDEE_FOLLOWING);

        const updatedEvents = await Models.AttendeeFollowing.findOne({ userId: TESTER_ATTENDEE_FOLLOWING.userId });
        expect(updatedEvents?.following).toContain(TESTER_EVENT_FOLLOWING.eventId);

        const updatedUsers = await Models.EventFollowers.findOne({ eventId: TESTER_EVENT_FOLLOWING.eventId });
        expect(updatedUsers?.followers).toContain(TESTER_ATTENDEE_FOLLOWING.userId);
    });
});

describe("PUT /user/unfollow/", () => {
    it("gives an not found error for a non-existent user", async () => {
        await Models.AttendeeFollowing.deleteOne({
            userId: TESTER_ATTENDEE_FOLLOWING.userId,
        });

        const response = await putAsAttendee(`/user/unfollow/`)
            .send({ eventId: TESTER_EVENT_FOLLOWING.eventId })
            .expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "UserNotFound");
    });

    it("gives an not found error for a non-existent event", async () => {
        await Models.EventFollowers.deleteOne({
            eventId: TESTER_EVENT_FOLLOWING.eventId,
        });

        // await Models.EventMetadata.deleteOne({
        //     eventId: TESTER_EVENT_FOLLOWING.eventId,
        // });

        const response = await putAsAttendee(`/user/unfollow/`)
            .send({ eventId: TESTER_EVENT_FOLLOWING.eventId })
            .expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "EventNotFound");
    });

    it("works for an attendee user", async () => {
        await Models.EventFollowers.findOneAndUpdate(
            { eventId: TESTER_EVENT_FOLLOWING.eventId },
            { $addToSet: { followers: TESTER_ATTENDEE_FOLLOWING.userId } },
            { new: true },
        );
        await Models.AttendeeFollowing.findOneAndUpdate(
            { userId: TESTER_ATTENDEE_FOLLOWING.userId },
            { $addToSet: { following: TESTER_EVENT_FOLLOWING.eventId } },
            { new: true },
        );

        const response = await putAsAttendee(`/user/unfollow/`)
            .send({ eventId: TESTER_EVENT_FOLLOWING.eventId })
            .expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject(TESTER_ATTENDEE_FOLLOWING);

        const updatedEvents = await Models.AttendeeFollowing.findOne({ userId: TESTER_ATTENDEE_FOLLOWING.userId });
        expect(updatedEvents).toEqual(expect.not.arrayContaining([TESTER_EVENT_FOLLOWING.eventId]));

        const updatedUsers = await Models.EventFollowers.findOne({ eventId: TESTER_EVENT_FOLLOWING.eventId });
        expect(updatedUsers).toEqual(expect.not.arrayContaining([TESTER_ATTENDEE_FOLLOWING.userId]));
    });
});
