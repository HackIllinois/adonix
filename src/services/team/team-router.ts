import { Router } from "express";
import { StatusCode } from "status-code-enum";
import { z } from "zod";

import { Role } from "../auth/auth-schemas";
import specification, { Tag } from "../../middleware/specification";
import Models from "../../common/models";
import { isValidObjectId } from "mongoose";

import { TeamSchema, TeamNotFoundError, TeamNotFoundErrorSchema } from "./team-schemas";

import { StaffInfoSchema } from "../staff/staff-schemas";

const teamRouter = Router();

teamRouter.get(
    "/",
    specification({
        method: "get",
        path: "/team/",
        tag: Tag.USER,
        role: Role.USER,
        summary: "Gets all teams",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "List of all teams",
                schema: z.array(TeamSchema),
            },
        },
    }),
    async (_req, res) => {
        const teams = await Models.Team.find();
        return res.status(StatusCode.SuccessOK).json(teams);
    },
);

teamRouter.get(
    "/:id/",
    specification({
        method: "get",
        path: "/team/{id}/",
        tag: Tag.USER,
        role: Role.USER,
        summary: "Gets a team and its staff",
        parameters: z.object({
            id: z.string(),
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Team and its staff members",
                schema: z.object({
                    team: TeamSchema,
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
        const team = await Models.Team.findById(id);
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

teamRouter.post(
    "/",
    specification({
        method: "post",
        path: "/team/",
        tag: Tag.USER,
        role: Role.STAFF,
        summary: "Creates a new team",
        responses: {
            [StatusCode.SuccessCreated]: {
                description: "The created team",
                schema: TeamSchema,
            },
        },
    }),
    async (req, res) => {
        const team = await Models.Team.create(req.body);
        return res.status(StatusCode.SuccessCreated).json(team);
    },
);

teamRouter.put(
    "/:id/",
    specification({
        method: "put",
        path: "/team/{id}/",
        tag: Tag.USER,
        role: Role.STAFF,
        summary: "Updates a team by ID",
        parameters: z.object({
            id: z.string(),
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Updated team",
                schema: TeamSchema,
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
        const updateData = TeamSchema.parse(req.body);
        const team = await Models.Team.findByIdAndUpdate(id, updateData, { new: true });
        if (!team) {
            return res.status(StatusCode.ClientErrorNotFound).json(TeamNotFoundError);
        }
        return res.status(StatusCode.SuccessOK).json(team);
    },
);

teamRouter.delete(
    "/:id/",
    specification({
        method: "delete",
        path: "/team/{id}/",
        tag: Tag.USER,
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
        const team = await Models.Team.findByIdAndDelete(id);
        if (!team) {
            return res.status(StatusCode.ClientErrorNotFound).json(TeamNotFoundError);
        }
        return res.status(StatusCode.SuccessNoContent).send();
    },
);

export default teamRouter;
