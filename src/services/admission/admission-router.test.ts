import { beforeEach, describe, expect, it } from "@jest/globals";
import Models from "../../database/models.js";
import { DecisionStatus, DecisionResponse } from "../../database/decision-db.js";
import { getAsAttendee, getAsStaff, getAsUser, putAsStaff, putAsUser, TESTER } from "../../testTools.js";
import { DecisionInfo } from "../../database/decision-db.js";
import { StatusCode } from "status-code-enum";
import { ApplicantDecisionFormat } from "./admission-formats.js";

const TESTER_USER = {
    userId: TESTER.id,
    status: DecisionStatus.ACCEPTED,
    response: DecisionResponse.PENDING,
    emailSent: false,
    reviewer: "tester-reviewer",
} satisfies DecisionInfo;

const OTHER_USER = {
    userId: "other-user",
    status: DecisionStatus.REJECTED,
    response: DecisionResponse.DECLINED,
    emailSent: true,
    reviewer: "other-reviewer",
} satisfies DecisionInfo;

const updateData = [
    {
        userId: TESTER.id,
        name: TESTER.name,
        status: DecisionStatus.WAITLISTED,
    },
    {
        userId: "other-user",
        name: "other-name",
        status: DecisionStatus.ACCEPTED,
    },
] satisfies ApplicantDecisionFormat[];

beforeEach(async () => {
    Models.initialize();
    await Models.DecisionInfo.create(TESTER_USER);
    await Models.DecisionInfo.create(OTHER_USER);
});

describe("GET /admission", () => {
    it("gives forbidden error for user without elevated perms", async () => {
        const responseUser = await getAsUser("/admission/").expect(StatusCode.ClientErrorForbidden);
        expect(JSON.parse(responseUser.text)).toHaveProperty("error", "Forbidden");
    });
    it("gives forbidden error for user without elevated perms - attendee", async () => {
        const responseAttendee = await getAsAttendee("/admission/").expect(StatusCode.ClientErrorForbidden);
        expect(JSON.parse(responseAttendee.text)).toHaveProperty("error", "Forbidden");
    });
    it("should return a list of applicants without email sent", async () => {
        const response = await getAsStaff("/admission/").expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject(expect.arrayContaining([expect.objectContaining(TESTER_USER)]));
    });
});

describe("PUT /admission", () => {
    it("gives forbidden error for user without elevated perms (As Attendee)", async () => {
        const responseUser = await putAsUser("/admission/").send(updateData).expect(StatusCode.ClientErrorForbidden);
        expect(JSON.parse(responseUser.text)).toHaveProperty("error", "Forbidden");
    });
    it("should update application status of applicants", async () => {
        const response = await putAsStaff("/admission/").send(updateData).expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toHaveProperty("message", "StatusSuccess");
        const ops = updateData.map((entry) => {
            return Models.DecisionInfo.findOne({ userId: entry.userId });
        });
        const retrievedEntries = await Promise.all(ops);
        expect(retrievedEntries).toMatchObject(
            expect.arrayContaining(
                updateData.map((item) => expect.objectContaining({ status: item.status, userId: item.userId })),
            ),
        );
    });
});
