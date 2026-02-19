import { beforeEach, describe, expect, it } from "@jest/globals";
import { getAsAttendee, postAsStaff, putAsStaff, delAsStaff } from "../../common/testTools";
import { StatusCode } from "status-code-enum";
import Models from "../../common/models";
import { StaffInfo } from "../staff/staff-schemas";

const TEST_TEAM = {
    name: "Systems",
};

const UPDATED_TEAM = {
    name: "Design",
};

const TEST_STAFF = {
    firstName: "Sh",
    lastName: "Long",
    title: "API",
    isActive: true,
    email: "shlong@example.com",
    staffEmail: "shlong@hackillinois.org",
    major: "Computer Science",
    education: "Undergraduate",
    graduate: "Fall 2025",
    school: "University of Illinois Urbana-Champaign",
    userId: "some-staff-user",
} satisfies StaffInfo;

beforeEach(async () => {
    await Models.StaffTeam.deleteMany({});
    await Models.UserInfo.deleteMany({});
});

describe("GET /staff-team/", () => {
    it("returns an empty list when no teams exist", async () => {
        const response = await getAsAttendee("/staff-team/").expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toEqual([]);
    });

    it("returns all existing teams", async () => {
        const createdTeam = await Models.StaffTeam.create(TEST_TEAM);

        const response = await getAsAttendee("/staff-team/").expect(StatusCode.SuccessOK);
        const data = JSON.parse(response.text);

        expect(Array.isArray(data)).toBe(true);
        expect(data[0]).toMatchObject({
            _id: createdTeam.id,
            name: TEST_TEAM.name,
        });
    });
});

describe("GET /staff-team/:id/", () => {
    it("returns 404 if team does not exist", async () => {
        const response = await getAsAttendee("/staff-team/invalidId/").expect(StatusCode.ClientErrorNotFound);
        expect(JSON.parse(response.text)).toMatchObject({
            error: "NotFound",
            message: "Failed to find team",
        });
    });

    it("returns a team and its associated staff", async () => {
        const createdTeam = await Models.StaffTeam.create(TEST_TEAM);

        await Models.StaffInfo.create({
            ...TEST_STAFF,
            team: createdTeam.id,
        });

        const response = await getAsAttendee(`/staff-team/${createdTeam.id}/`).expect(StatusCode.SuccessOK);
        const data = JSON.parse(response.text);

        expect(data.team).toMatchObject({
            _id: createdTeam.id,
            name: TEST_TEAM.name,
        });

        expect(data.staff.length).toBe(1);
        expect(data.staff[0]).toMatchObject({
            team: createdTeam.id,
            title: TEST_STAFF.title,
            firstName: TEST_STAFF.firstName,
            lastName: TEST_STAFF.lastName,
        });
    });
});

describe("POST /staff-team/", () => {
    it("creates a new team successfully", async () => {
        const response = await postAsStaff("/staff-team/").send(TEST_TEAM).expect(StatusCode.SuccessCreated);
        const created = JSON.parse(response.text);

        expect(created).toHaveProperty("_id");
        expect(created.name).toBe(TEST_TEAM.name);

        const dbTeam = await Models.StaffTeam.findById(created._id);
        expect(dbTeam?.toObject()).toMatchObject(TEST_TEAM);
    });
});

describe("PUT /staff-team/:id/", () => {
    it("returns 404 for non-existent team", async () => {
        const response = await putAsStaff("/staff-team/invalidId/").send(UPDATED_TEAM).expect(StatusCode.ClientErrorNotFound);
        expect(JSON.parse(response.text)).toMatchObject({
            error: "NotFound",
            message: "Failed to find team",
        });
    });

    it("updates an existing team successfully", async () => {
        const createdTeam = await Models.StaffTeam.create(TEST_TEAM);

        const response = await putAsStaff(`/staff-team/${createdTeam.id}/`).send(UPDATED_TEAM).expect(StatusCode.SuccessOK);

        const updated = JSON.parse(response.text);
        expect(updated.name).toBe(UPDATED_TEAM.name);

        const dbTeam = await Models.StaffTeam.findById(createdTeam.id);
        expect(dbTeam?.name).toBe(UPDATED_TEAM.name);
    });
});

describe("DELETE /staff-team/:id/", () => {
    it("returns 404 for non-existent team", async () => {
        const response = await delAsStaff("/staff-team/invalidId/").expect(StatusCode.ClientErrorNotFound);
        expect(JSON.parse(response.text)).toMatchObject({
            error: "NotFound",
            message: "Failed to find team",
        });
    });

    it("deletes an existing team successfully", async () => {
        const createdTeam = await Models.StaffTeam.create(TEST_TEAM);

        await delAsStaff(`/staff-team/${createdTeam.id}/`).expect(StatusCode.SuccessNoContent);

        const deleted = await Models.StaffTeam.findById(createdTeam.id);
        expect(deleted).toBeNull();
    });
});
