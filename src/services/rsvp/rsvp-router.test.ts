import { describe, expect, it, beforeEach } from "@jest/globals";
import { TESTER, getAsAttendee, getAsStaff, putAsApplicant, getAsAdmin } from "../../testTools.js";
import { DecisionStatus, DecisionResponse } from "../../database/decision-db.js";
import Models from "../../database/models.js";
import { StatusCode } from "status-code-enum";

const TESTER_DECISION_INFO = {
    userId: TESTER.id,
    status: DecisionStatus.ACCEPTED,
    response: DecisionResponse.PENDING,
    reviewer: "reviewer1",
    emailSent: true,
};

beforeEach(async () => {
    Models.initialize();
    await Models.DecisionInfo.create(TESTER_DECISION_INFO);
});

describe("GET /rsvp", () => {
    it("gives a UserNotFound error for an non-existent user", async () => {
        await Models.DecisionInfo.deleteOne({
            userId: TESTER.id,
        });

        const response = await getAsAttendee("/rsvp/").expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "UserNotFound");
    });

    it("works for an attendee user and returns filtered data", async () => {
        const response = await getAsAttendee("/rsvp/").expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({
            userId: TESTER.id,
            status: DecisionStatus.ACCEPTED,
            response: DecisionResponse.PENDING,
        });
    });

    it("works for a staff user and returns unfiltered data", async () => {
        const response = await getAsStaff("/rsvp/").expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject(TESTER_DECISION_INFO);
    });
});

describe("GET /rsvp/:USERID", () => {
    it("redirects to / if caller doesn't have elevated perms", async () => {
        const response = await getAsAttendee(`/rsvp/${TESTER.id}`).expect(302);

        expect(response.text).toBe("Found. Redirecting to /");
    });

    it("gets if caller has elevated perms (Staff)", async () => {
        const response = await getAsStaff(`/rsvp/${TESTER.id}`).expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject(TESTER_DECISION_INFO);
    });

    it("gets if caller has elevated perms (Admin)", async () => {
        const response = await getAsAdmin("/rsvp/" + TESTER.id).expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject(TESTER_DECISION_INFO);
    });

    it("returns UserNotFound error if user doesn't exist", async () => {
        await Models.DecisionInfo.deleteOne({
            userId: TESTER.id,
        });
        const response = await getAsStaff("/rsvp/idontexist").expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "UserNotFound");
    });
});

describe("PUT /rsvp", () => {
    it("error checking for empty query works", async () => {
        const response = await putAsApplicant("/rsvp/").send({}).expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "InvalidParams");
    });

    it("returns UserNotFound for nonexistent user", async () => {
        await Models.DecisionInfo.deleteOne({
            userId: TESTER.id,
        });
        const response = await putAsApplicant("/rsvp/").send({ isAttending: true }).expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "UserNotFound");
    });

    it("lets applicant accept accepted decision", async () => {
        const response = await putAsApplicant("/rsvp/").send({ isAttending: true }).expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toHaveProperty("response", DecisionResponse.ACCEPTED);
    });

    it("lets applicant reject accepted decision", async () => {
        const response = await putAsApplicant("/rsvp/").send({ isAttending: false }).expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toHaveProperty("response", DecisionResponse.DECLINED);
    });

    it("doesn't let applicant accept rejected decision", async () => {
        await Models.DecisionInfo.findOneAndUpdate({ userId: TESTER.id }, { status: DecisionStatus.REJECTED });

        const response = await putAsApplicant("/rsvp/").send({ isAttending: false }).expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });
});
