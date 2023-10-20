import { describe, expect, it, beforeEach } from "@jest/globals";
import { TESTER, get, getAsAdmin, getAsAttendee, getAsStaff } from "../../testTools.js";
import { DecisionStatus, DecisionResponse } from "../../database/decision-db.js";
import Models from "../../database/models.js";

// Before each test, add the tester to the user model
beforeEach(async () => {
    Models.initialize();
    await Models.DecisionInfo.create({
        userId: TESTER.id,
        status: DecisionStatus.ACCEPTED,
        response: DecisionResponse.PENDING,
    });
});

describe("GET /", () => {
    //i need to test
    // get /rsvp, gets own rsvp data
    // get /rsvp/:user, test w/ without perms, nonexistent user
    // put /rsvp w/ json req

    //good
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


describe("GET /:USERID", () => {
    //i need to test
    // get /rsvp, gets own rsvp data
    // get /rsvp/:user, test w/ without perms, nonexistent user
    // put /rsvp w/ json req
    
    //delete later
    it("gives an unauthorized error for an unauthenticated user", async () => {
        const response = await get("/rsvp/").expect(401);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NoToken");
    });
});


describe("PUT /", () => {
    //i need to test
    // get /rsvp, gets own rsvp data
    // get /rsvp/:user, test w/ without perms, nonexistent user
    // put /rsvp w/ json req
});
