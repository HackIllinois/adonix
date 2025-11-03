import { beforeEach, describe, expect, it } from "@jest/globals";
import { getAsAttendee, postAsStaff, putAsStaff, delAsStaff } from "../../common/testTools";
import { StatusCode } from "status-code-enum";
import Models from "../../common/models";

const TEST_TEAM = {
    name: "Systems",
};

const UPDATED_TEAM = {
    name: "Design",
};

const TEST_STAFF = {
    name: "Shlong",
    title: "API",
    isActive: true,
};

beforeEach(async () => {
    await Models.Team.deleteMany({});
    await Models.UserInfo.deleteMany({});
});

describe("GET /team/", () => {
    it("returns an empty list when no teams exist", async () => {
        const response = await getAsAttendee("/team/").expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toEqual([]);
    });

    it("returns all existing teams", async () => {
        const createdTeam = await Models.Team.create(TEST_TEAM);

        const response = await getAsAttendee("/team/").expect(StatusCode.SuccessOK);
        const data = JSON.parse(response.text);

        expect(Array.isArray(data)).toBe(true);
        expect(data[0]).toMatchObject({
            _id: createdTeam.id,
            name: TEST_TEAM.name,
        });
    });
});

describe("GET /team/:id/", () => {
    it("returns 404 if team does not exist", async () => {
        const response = await getAsAttendee("/team/invalidId/").expect(StatusCode.ClientErrorNotFound);
        expect(JSON.parse(response.text)).toMatchObject({
            error: "NotFound",
            message: "Failed to find team",
        });
    });

    it("returns a team and its associated staff", async () => {
        const createdTeam = await Models.Team.create(TEST_TEAM);

        await Models.StaffInfo.create({
            ...TEST_STAFF,
            team: createdTeam.id,
        });

        const response = await getAsAttendee(`/team/${createdTeam.id}/`).expect(StatusCode.SuccessOK);
        const data = JSON.parse(response.text);

        expect(data.team).toMatchObject({
            _id: createdTeam.id,
            name: TEST_TEAM.name,
        });

        expect(data.staff.length).toBe(1);
        expect(data.staff[0]).toMatchObject({
            team: createdTeam.id,
            title: TEST_STAFF.title,
            name: TEST_STAFF.name,
        });
    });
});

describe("POST /team/", () => {
    it("creates a new team successfully", async () => {
        const response = await postAsStaff("/team/").send(TEST_TEAM).expect(StatusCode.SuccessCreated);
        const created = JSON.parse(response.text);

        expect(created).toHaveProperty("_id");
        expect(created.name).toBe(TEST_TEAM.name);

        const dbTeam = await Models.Team.findById(created._id);
        expect(dbTeam?.toObject()).toMatchObject(TEST_TEAM);
    });
});

describe("PUT /team/:id/", () => {
    it("returns 404 for non-existent team", async () => {
        const response = await putAsStaff("/team/invalidId/").send(UPDATED_TEAM).expect(StatusCode.ClientErrorNotFound);
        expect(JSON.parse(response.text)).toMatchObject({
            error: "NotFound",
            message: "Failed to find team",
        });
    });

    it("updates an existing team successfully", async () => {
        const createdTeam = await Models.Team.create(TEST_TEAM);

        const response = await putAsStaff(`/team/${createdTeam.id}/`).send(UPDATED_TEAM).expect(StatusCode.SuccessOK);

        const updated = JSON.parse(response.text);
        expect(updated.name).toBe(UPDATED_TEAM.name);

        const dbTeam = await Models.Team.findById(createdTeam.id);
        expect(dbTeam?.name).toBe(UPDATED_TEAM.name);
    });
});

describe("DELETE /team/:id/", () => {
    it("returns 404 for non-existent team", async () => {
        const response = await delAsStaff("/team/invalidId/").expect(StatusCode.ClientErrorNotFound);
        expect(JSON.parse(response.text)).toMatchObject({
            error: "NotFound",
            message: "Failed to find team",
        });
    });

    it("deletes an existing team successfully", async () => {
        const createdTeam = await Models.Team.create(TEST_TEAM);

        await delAsStaff(`/team/${createdTeam.id}/`).expect(StatusCode.SuccessNoContent);

        const deleted = await Models.Team.findById(createdTeam.id);
        expect(deleted).toBeNull();
    });
});
