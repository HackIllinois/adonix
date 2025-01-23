import { Router } from "express";
import { StatusCode } from "status-code-enum";
import { Role } from "../auth/auth-schemas";
import specification, { Tag } from "../../middleware/specification";

import {
    NoTeamFoundError,
    NoTeamFoundErrorSchema,
    Project,
    ProjectProjectsSchema,
    ProjectsSchema,
    CreateProjectRequestSchema,
    UserAlreadyHasTeamError,
    UserAlreadyHasTeamErrorSchema,
    //ProjectMappingSchema,
    //PathTypeSchema,
    //TrackTypeSchema
} from "./project-schema";

//import { EventIdSchema, SuccessResponseSchema } from "../../common/schemas";
import { z } from "zod";
import Models from "../../common/models";
import { getAuthenticatedUser } from "../../common/auth";
import { UserIdSchema } from "../../common/schemas";
//import Config from "../../common/config";
//import crypto from "crypto";

const projectRouter = Router();

// GET details of specific team using ownerId (staff only)
projectRouter.get(
    "/owner/:ownerId/",
    specification({
        method: "get",
        path: "/project/owner/{ownerId}/",
        tag: Tag.PROJECT,
        role: Role.STAFF,
        summary: "Retrieve details of a team using ownerId",
        parameters: z.object({
            ownerId: UserIdSchema,
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The team for this specific ownerId",
                schema: ProjectProjectsSchema,
            },
            [StatusCode.ClientErrorConflict]: {
                description: "No team found for this ownerId",
                schema: NoTeamFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const ownerId = req.params.ownerId;
        const projectDetails = await Models.ProjectProjects.findOne({ ownerId });

        // Return no project found if no details were found
        if (!projectDetails) {
            return res.status(StatusCode.ClientErrorNotFound).send(NoTeamFoundError);
        }

        return res.status(StatusCode.SuccessOK).send(projectDetails);
    },
);

// GET details of user's team
projectRouter.get(
    "/details/",
    specification({
        method: "get",
        path: "/project/details/",
        tag: Tag.PROJECT,
        role: null,
        summary: "get details of user's team",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The user's team",
                schema: ProjectProjectsSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "No team found for the user",
                schema: NoTeamFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);
        const userMapping = await Models.ProjectMappings.findOne({ userId });
        if (!userMapping) {
            return res.status(StatusCode.ClientErrorNotFound).send(NoTeamFoundError);
        }
        const ownerId = userMapping?.teamOwnerId;

        // find project associated with the ownerId
        const projectDetails = await Models.ProjectProjects.findOne({ ownerId: ownerId });
        // return no team found error - fixes question mark issue

        return res.status(StatusCode.SuccessOK).send(projectDetails?.toObject());
    },
);

// POST create project/team
projectRouter.post(
    "/create",
    specification({
        method: "post",
        path: "/project/create/",
        tag: Tag.PROJECT,
        role: null,
        summary: "create a new project/team",
        body: CreateProjectRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The new team",
                schema: ProjectProjectsSchema,
            },
            [StatusCode.ClientErrorConflict]: {
                description: "The user already has a team",
                schema: UserAlreadyHasTeamErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);
        const details = req.body;

        const project: Project = {
            ownerId: userId,
            ...details,
        };
        // check if user isn't already mapped to a team
        // ensure teamOwner hasn't already made a team
        const ownerExists = (await Models.ProjectProjects.findOne({ ownerId: userId })) ?? false;
        if (ownerExists) {
            return res.status(StatusCode.ClientErrorConflict).send(UserAlreadyHasTeamError);
        }

        const newProject = await Models.ProjectProjects.create(project);

        return res.status(StatusCode.SuccessCreated).send(newProject);
    },
);

// POST join

// GET all projects (STAFF only)
projectRouter.get(
    "/list/",
    specification({
        method: "get",
        path: "/project/list/",
        tag: Tag.PROJECT,
        role: Role.STAFF, //staff only endpoint
        summary: "get list of all teams",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The projects",
                schema: ProjectsSchema,
            },
        },
    }),
    async (_req, res) => {
        const projects = await Models.ProjectProjects.find();
        return res.status(StatusCode.SuccessOK).send({ projects: projects });
    },
);

export default projectRouter;
