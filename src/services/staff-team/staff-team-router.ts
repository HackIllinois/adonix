import { Router } from "express";
import { StatusCode } from "status-code-enum";
import { z } from "zod";

import { Role } from "../auth/auth-schemas";
import specification, { Tag } from "../../middleware/specification";
import Models from "../../common/models";
import { isValidObjectId } from "mongoose";

import { StaffTeamSchema, TeamNotFoundError, TeamNotFoundErrorSchema } from "./staff-team-schemas";

import { StaffInfoSchema } from "../staff/staff-schemas";

const staffTeamRouter = Router();

staffTeamRouter.get(
    "/",
    specification({
        method: "get",
        path: "/staff-team/",
        tag: Tag.STAFFTEAM,
        role: Role.USER,
        summary: "Gets all teams",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "List of all teams",
                schema: z.array(StaffTeamSchema),
            },
        },
    }),
    async (_req, res) => {
        const teams = await Models.StaffTeam.find();
        return res.status(StatusCode.SuccessOK).json(teams);
    },
);

staffTeamRouter.get(
    "/:id/",
    specification({
        method: "get",
        path: "/staff-team/{id}/",
        tag: Tag.STAFFTEAM,
        role: Role.USER,
        summary: "Gets a team and its staff",
        parameters: z.object({
            id: z.string(),
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Team and its staff members",
                schema: z.object({
                    team: StaffTeamSchema,
                    staff: z.array(StaffInfoSchema).openapi({ description: "List of staff in the team" }),
                }),
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Could not find the team",
                schema: TeamNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(StatusCode.ClientErrorNotFound).json(TeamNotFoundError);
        }
        const team = await Models.StaffTeam.findById(id);
        if (!team) {
            return res.status(StatusCode.ClientErrorNotFound).json(TeamNotFoundError);
        }

        const staffMembers = await Models.StaffInfo.find({ team: id, isActive: true });
        const formattedStaffMembers = staffMembers.map((staff) => ({
            ...staff.toObject(),
            team: staff.team?.toString(),
        }));
        return res.status(StatusCode.SuccessOK).json({ team, staff: formattedStaffMembers });
    },
);

staffTeamRouter.post(
    "/",
    specification({
        method: "post",
        path: "/staff-team/",
        tag: Tag.STAFFTEAM,
        role: Role.STAFF,
        summary: "Creates a new team",
        responses: {
            [StatusCode.SuccessCreated]: {
                description: "The created team",
                schema: StaffTeamSchema,
            },
        },
    }),
    async (req, res) => {
        const team = await Models.StaffTeam.create(req.body);
        return res.status(StatusCode.SuccessCreated).json(team);
    },
);

staffTeamRouter.put(
    "/:id/",
    specification({
        method: "put",
        path: "/staff-team/{id}/",
        tag: Tag.STAFFTEAM,
        role: Role.STAFF,
        summary: "Updates a team by ID",
        parameters: z.object({
            id: z.string(),
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Updated team",
                schema: StaffTeamSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Could not find the team",
                schema: TeamNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(StatusCode.ClientErrorNotFound).json(TeamNotFoundError);
        }
        const updateData = StaffTeamSchema.parse(req.body);
        const team = await Models.StaffTeam.findByIdAndUpdate(id, updateData, { new: true });
        if (!team) {
            return res.status(StatusCode.ClientErrorNotFound).json(TeamNotFoundError);
        }
        return res.status(StatusCode.SuccessOK).json(team);
    },
);

staffTeamRouter.delete(
    "/:id/",
    specification({
        method: "delete",
        path: "/staff-team/{id}/",
        tag: Tag.STAFFTEAM,
        role: Role.STAFF,
        summary: "Deletes a team by ID",
        parameters: z.object({
            id: z.string(),
        }),
        responses: {
            [StatusCode.SuccessNoContent]: {
                description: "Successfully deleted team",
                schema: z.object({}).openapi({ description: "Empty response" }),
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Could not find the team",
                schema: TeamNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(StatusCode.ClientErrorNotFound).json(TeamNotFoundError);
        }
        const team = await Models.StaffTeam.findByIdAndDelete(id);
        if (!team) {
            return res.status(StatusCode.ClientErrorNotFound).json(TeamNotFoundError);
        }
        return res.status(StatusCode.SuccessNoContent).send();
    },
);

export default staffTeamRouter;
