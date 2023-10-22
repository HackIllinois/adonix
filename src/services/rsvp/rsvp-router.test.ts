import { describe, expect, it, beforeEach } from "@jest/globals";
import { TESTER, getAsAdmin, getAsAttendee, getAsStaff, putAsApplicant } from "../../testTools.js";
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
        await Models.DecisionInfo.deleteOne({
            userId: TESTER.id,
        });

        const response = await getAsAttendee("/rsvp/").expect(400);

        expect(JSON.parse(response.text)).toHaveProperty("error", "UserNotFound");
    });

    it("works for an attendee user", async () => {
        const response = await getAsAttendee("/rsvp/").expect(200);

        expect(JSON.parse(response.text)).toHaveProperty("userId", TESTER.id);
    });

    it("works for an staff user", async () => {
        const response = await getAsStaff("/rsvp/").expect(200);

        expect(JSON.parse(response.text)).toHaveProperty("userId", TESTER.id);
    });

    it("works for an admin user", async () => {
        const response = await getAsAdmin("/rsvp/").expect(200);

        expect(JSON.parse(response.text)).toHaveProperty("userId", TESTER.id);
    });
});

describe("GET /rsvp/:USERID", () => {
    it("redirects to / if caller doesn't have elevated perms", async () => {
        const response = await getAsAttendee("/rsvp/" + +TESTER.id).expect(302);

        expect(response.text).toBe("Found. Redirecting to /");
    });

    it("gets if caller has elevated perms (Staff)", async () => {
        const response = await getAsStaff("/rsvp/" + TESTER.id).expect(200);

        expect(JSON.parse(response.text)).toHaveProperty("userId", TESTER.id);
        expect(JSON.parse(response.text)).toHaveProperty("status");
        expect(JSON.parse(response.text)).toHaveProperty("response");
    });

    //By the way this test fails - I don't think the hasElevatedPerms functions checks for admin
    it("gets if caller has elevated perms (Admin)", async () => {
        const response = await getAsAdmin("/rsvp/" + +TESTER.id).expect(200);

        expect(JSON.parse(response.text)).toHaveProperty("userId", TESTER.id);
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
    it("works (ACCEPTED -> ACCEPT OFFER)", async () => {
        const response = await putAsApplicant("/rsvp/").send({ isAttending: true }).expect(200);

        expect(JSON.parse(response.text)).toHaveProperty("userId", TESTER.id);
        expect(JSON.parse(response.text)).toHaveProperty("response", DecisionResponse.ACCEPTED);
    });

    it("works (ACCEPTED -> DECLINE OFFER)", async () => {
        const response = await putAsApplicant("/rsvp/").send({ isAttending: false }).expect(200);

        expect(JSON.parse(response.text)).toHaveProperty("userId", TESTER.id);
        expect(JSON.parse(response.text)).toHaveProperty("response", DecisionResponse.DECLINED);
    });

    it("works (REJECTED -> ACCEPT OFFER)", async () => {
        await Models.DecisionInfo.findOneAndUpdate({ userId: TESTER.id }, { status: DecisionStatus.REJECTED });

        const response = await putAsApplicant("/rsvp/").send({ isAttending: false }).expect(403);

        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("works (REJECTED -> DECLINE OFFER)", async () => {
        await Models.DecisionInfo.findOneAndUpdate({ userId: TESTER.id }, { status: DecisionStatus.REJECTED });

        const response = await putAsApplicant("/rsvp/").send({ isAttending: false }).expect(403);

        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });
});
