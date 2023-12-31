import { beforeEach, describe, expect, it } from "@jest/globals";
import Models from "../../database/models.js";
import { DecisionStatus, DecisionResponse, AdmissionDecision } from "../../database/admission-db.js";
import { getAsStaff, getAsUser, putAsStaff, putAsUser, getAsAttendee, putAsApplicant, TESTER } from "../../testTools.js";
import { StatusCode } from "status-code-enum";
import { ApplicantDecisionFormat } from "./admission-formats.js";

const TESTER_DECISION = {
    userId: TESTER.id,
    status: DecisionStatus.ACCEPTED,
    response: DecisionResponse.PENDING,
    emailSent: false,
    reviewer: "tester-reviewer",
} satisfies AdmissionDecision;

const OTHER_DECISION = {
    userId: "other-user",
    status: DecisionStatus.REJECTED,
    response: DecisionResponse.DECLINED,
    emailSent: true,
    reviewer: "other-reviewer",
} satisfies AdmissionDecision;

const updateRequest = [
    {
        userId: TESTER.id,
        status: DecisionStatus.WAITLISTED,
    },
    {
        userId: "other-user",
        status: DecisionStatus.ACCEPTED,
    },
] satisfies ApplicantDecisionFormat[];

beforeEach(async () => {
    Models.initialize();
    await Models.AdmissionDecision.create(TESTER_DECISION);
    await Models.AdmissionDecision.create(OTHER_DECISION);
});

describe("GET /admission/not-sent/", () => {
    it("gives forbidden error for user without elevated perms", async () => {
        const responseUser = await getAsUser("/admission/not-sent/").expect(StatusCode.ClientErrorForbidden);
        expect(JSON.parse(responseUser.text)).toHaveProperty("error", "Forbidden");
    });
    it("should return a list of applicants without email sent", async () => {
        const response = await getAsStaff("/admission/not-sent/").expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject(expect.arrayContaining([expect.objectContaining(TESTER_DECISION)]));
    });
});

describe("PUT /admission/", () => {
    it("gives forbidden error for user without elevated perms", async () => {
        const responseUser = await putAsUser("/admission/").send(updateRequest).expect(StatusCode.ClientErrorForbidden);
        expect(JSON.parse(responseUser.text)).toHaveProperty("error", "Forbidden");
    });
    it("should update application status of applicants", async () => {
        const response = await putAsStaff("/admission/").send(updateRequest).expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toHaveProperty("message", "StatusSuccess");
        const ops = updateRequest.map((entry) => {
            return Models.AdmissionDecision.findOne({ userId: entry.userId });
        });
        const retrievedEntries = await Promise.all(ops);
        expect(retrievedEntries).toMatchObject(
            expect.arrayContaining(
                updateRequest.map((item) => {
                    return expect.objectContaining({ status: item.status, userId: item.userId });
                }),
            ),
        );
    });
});

describe("GET /admission/rsvp/", () => {
    it("gives a UserNotFound error for an non-existent user", async () => {
        await Models.AdmissionDecision.deleteOne({
            userId: TESTER.id,
        });

        const response = await getAsAttendee("/admission/rsvp/").expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "UserNotFound");
    });

    it("works for an attendee user and returns filtered data", async () => {
        const response = await getAsAttendee("/admission/rsvp/").expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({
            userId: TESTER_DECISION.userId,
            status: TESTER_DECISION.status,
            response: TESTER_DECISION.response,
        });
    });

    it("works for a staff user and returns unfiltered data", async () => {
        const response = await getAsStaff("/admission/rsvp/").expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject(TESTER_DECISION);
    });
});

describe("GET /admission/rsvp/:USERID", () => {
    it("returns forbidden error if caller doesn't have elevated perms", async () => {
        const response = await getAsAttendee(`/admission/rsvp/${TESTER.id}`).expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("gets if caller has elevated perms", async () => {
        const response = await getAsStaff(`/admission/rsvp/${TESTER.id}`).expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject(TESTER_DECISION);
    });

    it("returns UserNotFound error if user doesn't exist", async () => {
        const response = await getAsStaff("/admission/rsvp/idontexist").expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "UserNotFound");
    });
});

describe("PUT /admission/rsvp", () => {
    it("error checking for empty query works", async () => {
        const response = await putAsApplicant("/admission/rsvp/").send({}).expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "InvalidParams");
    });

    it("returns UserNotFound for nonexistent user", async () => {
        await Models.AdmissionDecision.deleteOne({
            userId: TESTER.id,
        });
        const response = await putAsApplicant("/admission/rsvp/")
            .send({ isAttending: true })
            .expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "UserNotFound");
    });

    it("lets applicant accept accepted decision", async () => {
        await putAsApplicant("/admission/rsvp/").send({ isAttending: true }).expect(StatusCode.SuccessOK);
        const stored = await Models.AdmissionDecision.findOne({ userId: TESTER.id });

        expect(stored).toMatchObject({
            ...TESTER_DECISION,
            response: DecisionResponse.ACCEPTED,
        } satisfies AdmissionDecision);
    });

    it("lets applicant reject accepted decision", async () => {
        await putAsApplicant("/admission/rsvp/").send({ isAttending: false }).expect(StatusCode.SuccessOK);
        const stored = await Models.AdmissionDecision.findOne({ userId: TESTER.id });

        expect(stored).toMatchObject({
            ...TESTER_DECISION,
            response: DecisionResponse.DECLINED,
        } satisfies AdmissionDecision);
    });

    it("doesn't let applicant accept rejected decision", async () => {
        await Models.AdmissionDecision.findOneAndUpdate({ userId: TESTER.id }, { status: DecisionStatus.REJECTED });

        const response = await putAsApplicant("/admission/rsvp/")
            .send({ isAttending: false })
            .expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NotAccepted");
    });
});
