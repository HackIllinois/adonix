import { describe, expect, it, beforeEach } from "@jest/globals";
import { TESTER, get, getAsAdmin, getAsAttendee, getAsStaff } from "../../testTools.js";
import { DecisionStatus, DecisionResponse } from "../../database/decision-db.js";
import Models from "../../database/models.js";

// Before each test it'll add this to the database
beforeEach(async () => {
    Models.initialize();
    await Models.DecisionInfo.create({
        userId: TESTER.id,
        status: DecisionStatus.ACCEPTED,
        response: DecisionResponse.PENDING,
    });
});

describe("GET /rsvp", () => {
    //i need to test
    // get /rsvp, gets own rsvp data
    // get /rsvp/:user, test w/ without perms, nonexistent user
    // put /rsvp w/ json req

    //good
    it("gives a UserNotFound error for an non-existent user", async () => {
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
            status: DecisionStatus.ACCEPTED,
            response: DecisionResponse.PENDING,
        });
    });

    it("works for an staff user", async () => {
        const response = await getAsStaff("/user/").expect(200);

        expect(JSON.parse(response.text)).toMatchObject({
            userId: TESTER.id,
            status: DecisionStatus.ACCEPTED,
            response: DecisionResponse.PENDING,
        });
    });

    it("works for an admin user", async () => {
        const response = await getAsAdmin("/user/").expect(200);

        expect(JSON.parse(response.text)).toMatchObject({
            userId: TESTER.id,
            status: DecisionStatus.ACCEPTED,
            response: DecisionResponse.PENDING,
        });
    });
});



describe("GET /rsvp/:USERID", () => {
    it("redirects to / if caller doesn't have elevated perms", async () => {
        const response = await getAsAttendee("/rsvp/user1").expect(200);

        expect(response.text).toBe("API is working!!!");
    });

    it("gets if caller has elevated perms (Staff)", async () => {
        const response = await getAsStaff("/rsvp/user1").expect(200);

        expect(JSON.parse(response.text)).toHaveProperty("userId", "user1");
        expect(JSON.parse(response.text)).toHaveProperty("status");
        expect(JSON.parse(response.text)).toHaveProperty("response");
    });

    it("gets if caller has elevated perms (Admin)", async () => {
        const response = await getAsAdmin("/rsvp/user1").expect(200);

        expect(JSON.parse(response.text)).toHaveProperty("userId", "user1");
        expect(JSON.parse(response.text)).toHaveProperty("status");
        expect(JSON.parse(response.text)).toHaveProperty("response");
    });

    it("returns UserNotFound error if user doesn't exist", async () => {
        const response = await getAsStaff("/rsvp/idontexist").expect(400);

        expect(JSON.parse(response.text)).toHaveProperty("error", "UserNotFound");
    });
});


describe("PUT /rsvp", () => {
    //i need to test
    // get /rsvp, gets own rsvp data
    // get /rsvp/:user, test w/ without perms, nonexistent user
    // put /rsvp w/ json req
});
