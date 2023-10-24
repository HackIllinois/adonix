import { describe, expect, it, beforeEach } from "@jest/globals";
import { TESTER, getAsAttendee, getAsStaff, putAsApplicant, getAsAdmin } from "../../testTools.js";
import { DecisionStatus, DecisionResponse } from "../../database/decision-db.js";
import Models from "../../database/models.js";

const TESTER_DECISION_INFO = {
    userId: TESTER.id,
    status: DecisionStatus.ACCEPTED,
    response: DecisionResponse.PENDING,
}

beforeEach(async () => {
    Models.initialize();
    await Models.DecisionInfo.create( TESTER_DECISION_INFO );
});

describe("GET /rsvp", () => {
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

});

describe("GET /rsvp/:USERID", () => {
    it("redirects to / if caller doesn't have elevated perms", async () => {
        const response = await getAsAttendee(`/rsvp/${TESTER.id}`).expect(302);

        expect(response.text).toBe("Found. Redirecting to /");
    });

    it("gets if caller has elevated perms (Staff)", async () => {
        const response = await getAsStaff(`/rsvp/${TESTER.id}`).expect(200);

        expect(JSON.parse(response.text)).toMatchObject(TESTER_DECISION_INFO);
    });

    it("gets if caller has elevated perms (Admin)", async () => {
        const response = await getAsAdmin("/rsvp/" + TESTER.id).expect(200);

        expect(JSON.parse(response.text)).toMatchObject(TESTER_DECISION_INFO);
    });

    it("returns UserNotFound error if user doesn't exist", async () => {
        await Models.DecisionInfo.deleteOne({
            userId: TESTER.id,
        });
        const response = await getAsStaff("/rsvp/idontexist").expect(400);

        expect(JSON.parse(response.text)).toHaveProperty("error", "UserNotFound");
    });
});

describe("PUT /rsvp", () => {
    it("error checking for empty query works", async () => {
        const response = await putAsApplicant("/rsvp/").send({ }).expect(400);

        expect(JSON.parse(response.text)).toHaveProperty("error", "InvalidParams");
    });

    it("returns UserNotFound for nonexistent user", async () => {
        await Models.DecisionInfo.deleteOne({
            userId: TESTER.id,
        });
        const response = await putAsApplicant("/rsvp/").send({ isAttending: true }).expect(400);

        expect(JSON.parse(response.text)).toHaveProperty("error", "UserNotFound");
    });

    it("applicant accepts accepted decision", async () => {
        const response = await putAsApplicant("/rsvp/").send({ isAttending: true }).expect(200);

        expect(JSON.parse(response.text)).toHaveProperty("response", DecisionResponse.ACCEPTED);
    });

    it("applicant rejects accepted decision", async () => {
        const response = await putAsApplicant("/rsvp/").send({ isAttending: false }).expect(200);

        expect(JSON.parse(response.text)).toHaveProperty("response", DecisionResponse.DECLINED);
    });

    it("applicant tries to accept rejected decision (shouldn't work)", async () => {
        await Models.DecisionInfo.findOneAndUpdate({ userId: TESTER.id }, { status: DecisionStatus.REJECTED });

        const response = await putAsApplicant("/rsvp/").send({ isAttending: false }).expect(403);

        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("applicant rejects rejected decision", async () => {
        await Models.DecisionInfo.findOneAndUpdate({ userId: TESTER.id }, { status: DecisionStatus.REJECTED });

        const response = await putAsApplicant("/rsvp/").send({ isAttending: false }).expect(403);

        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });
});
