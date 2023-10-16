import { describe, expect, it, beforeEach } from "@jest/globals";
import { TESTER, get, getAsAdmin, getAsAttendee, getAsStaff } from "../../testTools.js";
console.log("models loaded from user test");
import Models from "../../database/models.js";

// Before each test, add the tester to the user model
beforeEach(async () => {
    console.log("run init user");
    Models.initialize();
    await Models.UserInfo.create({
        userId: TESTER.id,
        name: TESTER.name,
        email: TESTER.email,
    });
});

describe("GET /", () => {
    it("gives an unauthorized error for an unauthenticated user", async () => {
        const response = await get("/user/").expect(401);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NoToken");
    });

    it("gives an not found error for an non-existent user", async () => {
        await Models.UserInfo.deleteOne({
            userId: TESTER.id,
        });

        const response = await getAsAttendee("/user/").expect(400);

        expect(JSON.parse(response.text)).toHaveProperty("error", "UserNotFound");
    });

    it("works for an attendee user", async () => {
        const response = await getAsAttendee("/user/").expect(200);

        expect(JSON.parse(response.text)).toMatchObject({
            userId: TESTER.id,
            name: TESTER.name,
            email: TESTER.email,
        });
    });

    it("works for an staff user", async () => {
        const response = await getAsStaff("/user/").expect(200);

        expect(JSON.parse(response.text)).toMatchObject({
            userId: TESTER.id,
            name: TESTER.name,
            email: TESTER.email,
        });
    });

    it("works for an admin user", async () => {
        const response = await getAsAdmin("/user/").expect(200);

        expect(JSON.parse(response.text)).toMatchObject({
            userId: TESTER.id,
            name: TESTER.name,
            email: TESTER.email,
        });
    });
});
