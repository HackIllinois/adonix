import { beforeEach, describe, expect, it } from "@jest/globals";
import Models from "../../database/models.js";
import { DecisionStatus, UpdateEntries } from "./admission-formats.js";
import { getAsAttendee, getAsStaff, getAsUser, putAsAttendee, putAsStaff, putAsUser } from "../../testTools.js";
import { DecisionInfo } from "../../database/decision-db.js";

beforeEach(async () => {
    Models.initialize();
});

describe("GET /admission", () => {
    it("gives forbidden error for user without elevated perms", async () => {
        const responseUser = await getAsUser("/admission/").expect(403);
        const responseAttendee = await getAsAttendee("/admission/").expect(403);
        expect(JSON.parse(responseUser.text)).toHaveProperty("error", "InvalidToken");
        expect(JSON.parse(responseAttendee.text)).toHaveProperty("error", "InvalidToken");
    });

    it("should return a list of applicants without email sent", async () => {
        const response = await getAsStaff("/admission/").expect(200);
        expect(JSON.parse(response.text)).toHaveProperty("entries");
        JSON.parse(response.text).entries.forEach((entry: DecisionInfo) => {
            expect(entry.emailSent).toBe(false);
        });
    });
});

describe("PUT /admission", () => {
    it("gives forbidden error for user without elevated perms (As User and As Attendee)", async () => {
        const updateData: UpdateEntries = {
            entries: [
                {
                    _id: "1",
                    userId: "user1",
                    name: "Jason",
                    status: DecisionStatus.ACCEPTED,
                },
                {
                    _id: "2",
                    userId: "user2",
                    name: "Fred",
                    status: DecisionStatus.REJECTED,
                },
                {
                    _id: "3",
                    userId: "user3",
                    name: "John",
                    status: DecisionStatus.WAITLISTED,
                },
            ],
        };
        const responseUser = await putAsUser("/admission/").send(updateData).expect(403);
        const responseAttendee = await putAsAttendee("/admission/").send(updateData).expect(403);

        expect(JSON.parse(responseUser.text)).toHaveProperty("error", "InvalidToken");
        expect(JSON.parse(responseAttendee.text)).toHaveProperty("error", "InvalidToken");
    });

    it("should update application status of applicants", async () => {
        const updateData: UpdateEntries = {
            entries: [
                {
                    _id: "1",
                    userId: "user1",
                    name: "Jason",
                    status: DecisionStatus.ACCEPTED,
                },
                {
                    _id: "2",
                    userId: "user2",
                    name: "Fred",
                    status: DecisionStatus.REJECTED,
                },
                {
                    _id: "3",
                    userId: "user3",
                    name: "John",
                    status: DecisionStatus.WAITLISTED,
                },
            ],
        };

        const response = await putAsStaff("/admission/").send(updateData).expect(200);
        expect(JSON.parse(response.text)).toHaveProperty("message", "StatusSuccess");
    });
});
