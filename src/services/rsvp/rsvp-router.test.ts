import { describe, expect, it, beforeEach } from "@jest/globals";
import { TESTER, getAsAttendee, getAsStaff, putAsApplicant } from "../../testTools.js";
import { DecisionInfo, DecisionStatus, DecisionResponse } from "../../database/decision-db.js";
import Models from "../../database/models.js";
import { StatusCode } from "status-code-enum";

const TESTER_DECISION_INFO = {
    userId: TESTER.id,
    status: DecisionStatus.ACCEPTED,
    response: DecisionResponse.PENDING,
    reviewer: "reviewer1",
    emailSent: true,
} satisfies DecisionInfo;

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
        const response = await getAsAttendee(`/rsvp/${TESTER.id}`).redirects(1).expect(StatusCode.SuccessOK);

        expect(response.text).toBe("API is working!!!");
    });

    it("gets if caller has elevated perms", async () => {
        const response = await getAsStaff(`/rsvp/${TESTER.id}`).expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject(TESTER_DECISION_INFO);
    });

    it("returns UserNotFound error if user doesn't exist", async () => {
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
        await putAsApplicant("/rsvp/").send({ isAttending: true }).expect(StatusCode.SuccessOK);
        const stored = await Models.DecisionInfo.findOne({ userId: TESTER.id });

        if (stored) {
            const storedObject = stored.toObject();
            expect(storedObject).toHaveProperty("response", DecisionResponse.ACCEPTED);
        } else {
            expect(stored).not.toBeNull();
        }
    });

    it("lets applicant reject accepted decision", async () => {
        await putAsApplicant("/rsvp/").send({ isAttending: false }).expect(StatusCode.SuccessOK);
        const stored = await Models.DecisionInfo.findOne({ userId: TESTER.id });

        if (stored) {
            const storedObject = stored.toObject();
            expect(storedObject).toHaveProperty("response", DecisionResponse.DECLINED);
        } else {
            expect(stored).not.toBeNull();
        }
    });

    it("doesn't let applicant accept rejected decision", async () => {
        await Models.DecisionInfo.findOneAndUpdate({ userId: TESTER.id }, { status: DecisionStatus.REJECTED });

        const response = await putAsApplicant("/rsvp/").send({ isAttending: false }).expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NotAccepted");
    });
});
