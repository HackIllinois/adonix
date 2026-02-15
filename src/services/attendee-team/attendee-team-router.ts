import { Router } from "express";
import { StatusCode } from "status-code-enum";
import { z } from "zod";

import { Role } from "../auth/auth-schemas";
import specification, { Tag } from "../../middleware/specification";
import Models from "../../common/models";

import { TeamNotFoundError, TeamNotFoundErrorSchema } from "../staff-team/staff-team-schemas";
import { AttendeeTeamSchema, CreateAttendeeTeamRequestSchema } from "./attendee-team-schemas";
import { assignAttendeeTeams } from "./attendee-team-lib";

const attendeeTeamRouter = Router();

attendeeTeamRouter.post(
    "/",
    specification({
        method: "post",
        path: "/attendee-team/",
        tag: Tag.ATTENDEETEAM,
        role: Role.STAFF,
        summary: "Creates a new team",
        body: CreateAttendeeTeamRequestSchema,
        responses: {
            [StatusCode.SuccessCreated]: {
                description: "The created team",
                schema: AttendeeTeamSchema,
            },
        },
    }),
    async (req, res) => {
        const team = await Models.AttendeeTeam.create(req.body);
        return res.status(StatusCode.SuccessCreated).json(team);
    },
);

attendeeTeamRouter.get(
    "/",
    specification({
        method: "get",
        path: "/attendee-team/",
        tag: Tag.ATTENDEETEAM,
        role: null,
        summary: "Gets all teams",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "List of all teams",
                schema: z.array(AttendeeTeamSchema),
            },
        },
    }),
    async (_req, res) => {
        const teams = await Models.AttendeeTeam.find();
        return res.status(StatusCode.SuccessOK).json(teams);
    },
);

attendeeTeamRouter.delete(
    "/:id/",
    specification({
        method: "delete",
        path: "/attendee-team/{id}/",
        tag: Tag.ATTENDEETEAM,
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
        const team = await Models.AttendeeTeam.findByIdAndDelete(id);
        if (!team) {
            return res.status(StatusCode.ClientErrorNotFound).json(TeamNotFoundError);
        }
        return res.status(StatusCode.SuccessNoContent).send();
    },
);

attendeeTeamRouter.post(
    "/assign/",
    specification({
        method: "post",
        path: "/attendee-team/assign/",
        tag: Tag.ATTENDEETEAM,
        role: Role.STAFF,
        summary: "Assigns all attendees to random teams evenly",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "List of all teams",
                schema: z.array(AttendeeTeamSchema),
            },
        },
    }),
    async (_req, res) => {
        const teams = await assignAttendeeTeams();
        return res.status(StatusCode.SuccessOK).json(teams);
    },
);

export default attendeeTeamRouter;
