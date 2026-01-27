import { Router } from "express";
import { StatusCode } from "status-code-enum";
import { z } from "zod";

import { Role } from "../auth/auth-schemas";
import specification, { Tag } from "../../middleware/specification";
import Models from "../../common/models";
// import { isValidObjectId } from "mongoose";

// import { TeamNotFoundError, TeamNotFoundErrorSchema } from "./staff-team-schemas";
import { AttendeeTeamSchema, CreateAttendeeTeamRequestSchema } from "./attendee-team-schemas";

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
        role: Role.USER,
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

export default attendeeTeamRouter;
