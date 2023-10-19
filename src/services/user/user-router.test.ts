import { describe, expect, it, beforeEach } from "@jest/globals";
import { TESTER, get, getAsAdmin, getAsAttendee, getAsStaff, postAsAttendee, postAsStaff } from "../../testTools.js";
import Models from "../../database/models.js";
import { UserInfo } from "../../database/user-db.js";

const TESTER_USER = {
    userId: TESTER.id,
    name: TESTER.name,
    email: TESTER.email,
} satisfies UserInfo;

const TESTER_USER_WITH_NEW_EMAIL: Record<string, unknown> = {
    userId: TESTER.id,
    email: `${TESTER.email}-with-new-email.com`,
    name: TESTER.name,
} satisfies UserInfo;

const OTHER_USER: Record<string, unknown> = {
    userId: "other-user",
    email: `other-user@hackillinois.org`,
    name: "Other User",
} satisfies UserInfo;

const NEW_USER: Record<string, unknown> = {
    userId: "new-user",
    email: `new-user@hackillinois.org`,
    name: "New User",
} satisfies UserInfo;

// Before each test, add the tester to the user model
beforeEach(async () => {
    Models.initialize();
    await Models.UserInfo.create(TESTER_USER);
    await Models.UserInfo.create(OTHER_USER);
});

describe("GET /", () => {
    it("gives an unauthorized error for an unauthenticated user", async () => {
        const response = await get("/user/").expect(401);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NoToken");
    });

    it("gives an not found error for an non-existent user", async () => {
        await Models.UserInfo.deleteOne({
            userId: TESTER_USER.userId,
        });

        const response = await getAsAttendee("/user/").expect(404);

        expect(JSON.parse(response.text)).toHaveProperty("error", "UserNotFound");
    });

    it("works for an attendee user", async () => {
        const response = await getAsAttendee("/user/").expect(200);

        expect(JSON.parse(response.text)).toMatchObject(TESTER_USER);
    });

    it("works for an staff user", async () => {
        const response = await getAsStaff("/user/").expect(200);

        expect(JSON.parse(response.text)).toMatchObject(TESTER_USER);
    });

    it("works for an admin user", async () => {
        const response = await getAsAdmin("/user/").expect(200);

        expect(JSON.parse(response.text)).toMatchObject(TESTER_USER);
    });
});

describe("GET /:USERID/", () => {
    it("gives an forbidden error for a non-staff user", async () => {
        const response = await getAsAttendee(`/user/${OTHER_USER.userId}/`).expect(403);

        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("gives an not found error for a non-existent user", async () => {
        await Models.UserInfo.deleteOne({
            userId: OTHER_USER.userId,
        });

        const response = await getAsStaff(`/user/${OTHER_USER.userId}/`).expect(404);

        expect(JSON.parse(response.text)).toHaveProperty("error", "UserNotFound");
    });

    it("works for a non-staff user requesting themselves", async () => {
        const response = await getAsAttendee(`/user/${TESTER_USER.userId}/`).expect(200);

        expect(JSON.parse(response.text)).toMatchObject(TESTER_USER);
    });

    it("works for a staff user", async () => {
        const response = await getAsStaff(`/user/${OTHER_USER.userId}/`).expect(200);

        expect(JSON.parse(response.text)).toMatchObject(OTHER_USER);
    });
});

describe("POST /", () => {
    it("gives an unauthorized error for an non-staff user", async () => {
        const response = await postAsAttendee("/user/").send(JSON.stringify(TESTER_USER_WITH_NEW_EMAIL)).expect(403);

        expect(JSON.parse(response.text)).toHaveProperty("error", "InvalidToken");
    });
    it("gives an bad format error for bad data", async () => {
        const response = await postAsStaff("/user/")
            .send(
                JSON.stringify({
                    nonsense: 123,
                }),
            )
            .expect(400);

        expect(JSON.parse(response.text)).toHaveProperty("error", "InvalidParams");
    });
    it("creates a user for an staff user", async () => {
        const response = await postAsStaff("/user/").send(JSON.stringify(NEW_USER)).expect(200);

        expect(JSON.parse(response.text)).toMatchObject(NEW_USER);

        const stored = await Models.UserInfo.findOne({
            userId: NEW_USER.userId,
        });

        expect(stored).toMatchObject(NEW_USER);
    });
    it("updates a user for an staff user", async () => {
        const response = await postAsStaff("/user/").send(JSON.stringify(TESTER_USER_WITH_NEW_EMAIL)).expect(200);

        expect(JSON.parse(response.text)).toMatchObject(TESTER_USER_WITH_NEW_EMAIL);

        const stored = await Models.UserInfo.findOne({
            userId: TESTER_USER_WITH_NEW_EMAIL.userId,
        });

        expect(stored).toMatchObject(TESTER_USER_WITH_NEW_EMAIL);
    });
});
