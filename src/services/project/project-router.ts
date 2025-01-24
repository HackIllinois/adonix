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
    AccessCodeSchema,
    ProjectUpdateSchema,
    ProjectAccessCodeSchema,
    //ProjectMappingSchema,
    //PathTypeSchema,
    //TrackTypeSchema
} from "./project-schema";

//import { EventIdSchema, SuccessResponseSchema } from "../../common/schemas";
import { z } from "zod";
import Models from "../../common/models";
import { getAuthenticatedUser } from "../../common/auth";
import { UserIdSchema } from "../../common/schemas";
import { UserNotFoundError, UserNotFoundErrorSchema } from "../user/user-schemas";
import Config from "../../common/config";
//import Config from "../../common/config";
//import crypto from "crypto";

const projectRouter = Router();
const RADIX = 36;
const EXPIRY = 300000;
const SUBSTRING_START = 2;
const SUBSTRING_END = 2;
type AllowedUpdates = Partial<Pick<Project, "description" | "projectName" | "path" | "track" | "githubLink" | "videoLink">>;

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

        // generate access code
        const accessCode = Math.random().toString(RADIX).substring(SUBSTRING_START, SUBSTRING_END).toUpperCase();

        // set expiry time
        const expiryTime = new Date(Date.now() + EXPIRY).toISOString();

        const project: Project = {
            ownerId: userId,
            accessCode,
            expiryTime,
            ...details,
        };

        // check if user isn't already mapped to a team
        const existingMapping = (await Models.ProjectMappings.findOne({ userId: userId })) ?? false;
        if (existingMapping) {
            return res.status(StatusCode.ClientErrorConflict).send(UserAlreadyHasTeamError);
        }

        // ensure teamOwner hasn't already made a team
        const ownerExists = (await Models.ProjectProjects.findOne({ ownerId: userId })) ?? false;
        if (ownerExists) {
            return res.status(StatusCode.ClientErrorConflict).send(UserAlreadyHasTeamError);
        }

        // make a new project mapping
        await Models.ProjectMappings.create({
            teamOwnerId: userId,
            userId: userId,
        });

        const newProject = await Models.ProjectProjects.create(project);

        return res.status(StatusCode.SuccessCreated).send(newProject);
    },
);

// PATCH update (only owner)
projectRouter.patch(
    "/update",
    specification({
        method: "patch",
        path: "/project/update/",
        tag: Tag.PROJECT,
        role: null,
        summary: "update a team - owner only",
        body: ProjectUpdateSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Project updated",
                schema: ProjectProjectsSchema, // fix?
            },
            [StatusCode.ClientErrorForbidden]: {
                description: "Only owner can update project",
                schema: ProjectProjectsSchema, // fix?
            },
            [StatusCode.ClientErrorBadRequest]: {
                description: "Could not update project",
                schema: ProjectProjectsSchema, // fix?
            },
        },
    }),
    async (_req, res) => {
        const { id: userId } = getAuthenticatedUser(_req);
        const updateData: AllowedUpdates = _req.body;

        const restrictedFields = ["accessCode", "teamMembers", "ownerId"];
        const invalidFields = Object.keys(updateData).filter((field) => restrictedFields.includes(field));
        if (invalidFields.length > 0) {
            return res.status(StatusCode.ClientErrorBadRequest); // send better error
        }

        // find project
        const updatedProject = await Models.ProjectProjects.findOneAndUpdate(
            { ownerId: userId }, // Filter
            { $set: updateData }, // Update
            { new: true },
        );
        if (!updatedProject) {
            return res.status(StatusCode.ClientErrorForbidden);
        }

        return res.status(StatusCode.SuccessOK).send(updatedProject);
    },
);

// POST join
projectRouter.post(
    "/join",
    specification({
        method: "post",
        path: "/project/join/",
        tag: Tag.PROJECT,
        role: null,
        summary: "join a team",
        body: AccessCodeSchema, // should be access code
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Team joined",
                schema: ProjectProjectsSchema,
            },
            [StatusCode.ClientErrorConflict]: {
                description: "Already part of team",
                schema: UserAlreadyHasTeamErrorSchema,
            },
            // more status codes
        },
    }),
    async (_req, res) => {
        const { id: userId } = getAuthenticatedUser(_req);
        const { accessCode } = _req.body;

        // check if access code valid
        const project = await Models.ProjectProjects.findOne({ accessCode });
        if (!project) {
            return res.status(StatusCode.ClientErrorBadRequest); // fix this
        }

        if (new Date() > new Date(project.expiryTime)) {
            return res.status(StatusCode.ClientErrorBadRequest); // fix this too
        }

        // user not already part of team
        const existingMapping = await Models.ProjectMappings.findOne({ userId });
        if (existingMapping) {
            return res.status(StatusCode.ClientErrorConflict).send(UserAlreadyHasTeamError);
        }

        // check if team not full (array of members <= 4)
        if (project.teamMembers.length >= Config.TEAM_SIZE) {
            return res.status(StatusCode.ClientErrorBadRequest); // fix this
        }

        // does not have track/path conflicts with team - come back to this

        // updates the teams ProjectProjects AND creates user's projectMappings entry
        project.teamMembers.push(userId);
        await project.save();

        await Models.ProjectMappings.create({
            teamOwnerId: project.ownerId,
            userId: userId,
        });

        return res.status(StatusCode.SuccessOK).send(project);
    },
);

// POST leave
projectRouter.post(
    "/leave/",
    specification({
        method: "post",
        path: "/project/leave/",
        tag: Tag.PROJECT,
        role: Role.STAFF,
        summary: "allow user to leave team",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Left project",
                schema: UserIdSchema, // probably have to change
            },
            [StatusCode.ClientErrorConflict]: {
                description: "Can't find user",
                schema: UserNotFoundErrorSchema,
            },
        },
    }),
    async (_req, res) => {
        const { id: userId } = getAuthenticatedUser(_req);

        // check if user on team
        const mapping = await Models.ProjectMappings.findOne({ userId });
        if (!mapping) {
            return res.status(StatusCode.ClientErrorConflict).send(UserNotFoundError);
        }

        const project = await Models.ProjectProjects.findOne({ ownerId: mapping.teamOwnerId });
        if (!project) {
            return res.status(StatusCode.ClientErrorConflict);
        }

        // if user is the owner of the project
        if (project.ownerId == userId) {
            if (project.teamMembers.length > 1) {
                return res.status(StatusCode.ClientErrorForbidden); // fix
            }

            await Models.ProjectProjects.deleteOne({ _id: project._id });
            await Models.ProjectMappings.deleteOne({ teamOwnerId: userId });
            return res.status(StatusCode.SuccessOK); // fix
        }

        // if user not owner
        project.teamMembers = project.teamMembers.filter((member) => member != userId);
        await project.save();

        await Models.ProjectMappings.deleteOne({ userId: userId });
        return res.status(StatusCode.SuccessOK); // fix
    },
);

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

projectRouter.delete(
    "/member/:userId",
    specification({
        method: "delete",
        path: "/project/member/:userId",
        tag: Tag.PROJECT,
        role: null,
        summary: "Remove a user from the team",
        parameters: z.object({
            userId: UserIdSchema,
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "User removed from team successfully",
                schema: UserIdSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "User is not part of any team",
                schema: NoTeamFoundErrorSchema,
            },
        },
    }),
    async (_req, res) => {
        const { userId } = _req.params;
        const mapping = await Models.ProjectMappings.findOne({ userId: userId });
        if (!mapping) {
            return res.status(StatusCode.ClientErrorNotFound).send(NoTeamFoundError);
        }

        const project = await Models.ProjectProjects.findOne({ ownerId: mapping.teamOwnerId });
        if (!project) {
            return res.status(StatusCode.ClientErrorNotFound).send(NoTeamFoundError); // send better error?
        }

        // remove user from project
        project.teamMembers = project.teamMembers.filter((member) => member != userId);
        await project.save();

        // remove user's mapping entry also
        await Models.ProjectMappings.deleteOne({ userId: userId });

        return res.status(StatusCode.SuccessOK).send(userId); // fix?
    },
);

projectRouter.get(
    "/generate-access-token",
    specification({
        method: "get",
        path: "/project/generate-access-code/",
        tag: Tag.PROJECT,
        role: null,
        summary: "Generate the team's access code",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Access code generated successfully",
                schema: ProjectAccessCodeSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "No project found",
                schema: NoTeamFoundErrorSchema,
            },
            // add more error codes
        },
    }),
    async (_req, res) => {
        const { id: userId } = getAuthenticatedUser(_req);
        const project = await Models.ProjectProjects.findOne({ ownerId: userId });
        if (!project) {
            return res.status(StatusCode.ClientErrorNotFound).send(NoTeamFoundError);
        }

        // generate access code
        const accessCode = Math.random().toString(RADIX).substring(SUBSTRING_START, SUBSTRING_END).toUpperCase();

        // set expiry time
        const expiryTime = new Date(Date.now() + EXPIRY).toISOString();

        // update project
        project.accessCode = accessCode;
        project.expiryTime = expiryTime;
        await project.save();

        return res.status(StatusCode.SuccessOK).send({
            ownerId: userId,
            accessCode,
            expiryTime,
        });
    },
);

export default projectRouter;
