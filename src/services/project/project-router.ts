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
    AccessCodeSchema,
    ProjectUpdateSchema,
    ProjectAccessCodeSchema,
    InvalidAccessCodeError,
    InvalidAccessCodeErrorSchema,
    UserHasConflictErrorSchema,
    UserHasConflictError,
    PathType,
    ForbiddenError,
    ForbiddenErrorSchema,
} from "./project-schema";

import { z } from "zod";
import Models from "../../common/models";
import { getAuthenticatedUser, getRoles } from "../../common/auth";
import { UserIdSchema } from "../../common/schemas";
import { UserNotFoundError, UserNotFoundErrorSchema } from "../user/user-schemas";
import Config from "../../common/config";

const projectRouter = Router();

// Constants for access code generation and expiry time
const RADIX = 36;
const EXPIRY = 300000; // 5 minutes in milliseconds
const ACCESS_CODE_LENGTH = 5;

type AllowedUpdates = Partial<Pick<Project, "description" | "projectName" | "path" | "track" | "githubLink" | "videoLink">>;

// GET details of specific team using ownerId (staff only)
projectRouter.get(
    "/:ownerId/",
    specification({
        method: "get",
        path: "/project/{ownerId}/",
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

        if (!projectDetails) {
            return res.status(StatusCode.ClientErrorNotFound).send(NoTeamFoundError);
        }

        return res.status(StatusCode.SuccessOK).send(projectDetails);
    },
);

// GET details of user's team
projectRouter.get(
    "/",
    specification({
        method: "get",
        path: "/project/",
        tag: Tag.PROJECT,
        role: Role.ATTENDEE,
        summary: "Get details of user's team",
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
        const ownerId = userMapping.teamOwnerId;

        const projectDetails = await Models.ProjectProjects.findOne({ ownerId });
        if (!projectDetails) {
            return res.status(StatusCode.ClientErrorNotFound).send(NoTeamFoundError);
        }
        return res.status(StatusCode.SuccessOK).send(projectDetails.toObject());
    },
);

// POST create project/team
projectRouter.post(
    "/",
    specification({
        method: "post",
        path: "/project/",
        tag: Tag.PROJECT,
        role: Role.ATTENDEE,
        summary: "Create a new project/team",
        body: CreateProjectRequestSchema,
        responses: {
            [StatusCode.SuccessCreated]: {
                description: "The new team",
                schema: ProjectProjectsSchema,
            },
            [StatusCode.ClientErrorConflict]: {
                description: "The user already has a team",
                schema: UserHasConflictErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);
        const details = req.body;

        const accessCode = Math.random()
            .toString(RADIX)
            .substring(2, 2 + ACCESS_CODE_LENGTH)
            .toUpperCase();

        const expiryTime = new Date(Date.now() + EXPIRY).toISOString();

        const roles = await getRoles(userId);
        if (!roles) {
            throw Error("Invalid team member (roleless)");
        }
        if (!roles.includes(Role.PRO)) {
            details.path = PathType.GENERAL;
        }

        const project: Project = {
            ownerId: userId,
            accessCode,
            expiryTime,
            ...details,
        };

        // Rest of the create logic remains the same...
        const existingMapping = await Models.ProjectMappings.findOne({ userId });
        if (existingMapping) {
            return res.status(StatusCode.ClientErrorConflict).send(UserHasConflictError);
        }

        const ownerExists = await Models.ProjectProjects.findOne({ ownerId: userId });
        if (ownerExists) {
            return res.status(StatusCode.ClientErrorConflict).send(UserHasConflictError);
        }

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
    "/",
    specification({
        method: "patch",
        path: "/project/",
        tag: Tag.PROJECT,
        role: Role.ATTENDEE,
        summary: "Update a team - owner only",
        body: ProjectUpdateSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Project updated",
                schema: ProjectProjectsSchema,
            },
            [StatusCode.ClientErrorForbidden]: {
                description: "Only owner can update project",
                schema: ForbiddenErrorSchema,
            },
            [StatusCode.ClientErrorBadRequest]: {
                description: "Could not update project",
                schema: NoTeamFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);
        const updateData: AllowedUpdates = req.body;
        console.log(userId)

        // Find the current project
        const currentProject = await Models.ProjectProjects.findOne({ ownerId: userId });
        if (!currentProject) {
            return res.status(StatusCode.ClientErrorForbidden).send(ForbiddenError);
        }

        // If trying to update path to 'pro', validate all team members
        if (updateData.path === PathType.PRO) {
            let allMembersArePro = true;
            for (const memberId of [userId, ...currentProject.teamMembers]) {
                const roles = await getRoles(memberId);
                if (!roles) {
                    throw Error("Invalid team member (roleless)");
                }
                if (!roles.includes(Role.PRO)) {
                    allMembersArePro = false;
                }
            }

            if (!allMembersArePro) {
                updateData.path = PathType.GENERAL; // Force path to general if validation fails
            }
        }

        const restrictedFields = ["accessCode", "teamMembers", "ownerId", "expiryTime"];
        const filteredUpdateData = Object.entries(updateData)
            .filter(([key]) => !restrictedFields.includes(key))
            .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {} as AllowedUpdates);

        const updatedProject = await Models.ProjectProjects.findOneAndUpdate(
            { ownerId: userId },
            { $set: filteredUpdateData },
            { new: true },
        );

        if (!updatedProject) {
            return res.status(StatusCode.ClientErrorForbidden).send(ForbiddenError);
        }

        return res.status(StatusCode.SuccessOK).send(updatedProject);
    },
);

// POST join a team
projectRouter.post(
    "/join",
    specification({
        method: "post",
        path: "/project/join/",
        tag: Tag.PROJECT,
        role: Role.ATTENDEE,
        summary: "Join a team using an access code",
        body: AccessCodeSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Team joined",
                schema: ProjectProjectsSchema,
            },
            [StatusCode.ClientErrorConflict]: {
                description: "Already part of a team, or team full",
                schema: UserHasConflictErrorSchema,
            },
            [StatusCode.ClientErrorBadRequest]: {
                description: "Invalid access code, team full",
                schema: InvalidAccessCodeErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);
        const { accessCode } = req.body;

        const project = await Models.ProjectProjects.findOne({ accessCode });
        if (!project || new Date() > new Date(project.expiryTime)) {
            return res.status(StatusCode.ClientErrorBadRequest).send(InvalidAccessCodeError);
        }

        const existingMapping = await Models.ProjectMappings.findOne({ userId });
        if (existingMapping) {
            return res.status(StatusCode.ClientErrorConflict).send(UserHasConflictError);
        }

        if (project.teamMembers.length >= Config.TEAM_SIZE) {
            return res.status(StatusCode.ClientErrorBadRequest).send(UserHasConflictError);
        }

        // Check if project is 'pro' and new member isn't PRO
        if (project.path == PathType.PRO) {
            const userRoles = await getRoles(userId);
            if (!userRoles) {
                throw Error("Invalid team member (roleless)");
            }
            if (!userRoles.includes(Role.PRO)) {
                // Demote team to general if new member isn't PRO
                project.path = PathType.GENERAL;
            }
        }

        project.teamMembers.push(userId);
        await project.save();

        await Models.ProjectMappings.create({
            teamOwnerId: project.ownerId,
            userId: userId,
        });

        return res.status(StatusCode.SuccessOK).send(project);
    },
);

// POST leave team
projectRouter.post(
    "/leave/",
    specification({
        method: "post",
        path: "/project/leave/",
        tag: Tag.PROJECT,
        role: Role.ATTENDEE,
        summary: "Allow user to leave team",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Left project successfully",
                schema: UserIdSchema,
            },
            [StatusCode.ClientErrorConflict]: {
                description: "User not found in any team",
                schema: UserNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);

        // Check if user is in a team mapping
        const mapping = await Models.ProjectMappings.findOne({ userId });
        if (!mapping) {
            return res.status(StatusCode.ClientErrorConflict).send(UserNotFoundError);
        }

        const project = await Models.ProjectProjects.findOne({ ownerId: mapping.teamOwnerId });
        if (!project) {
            throw Error("Unable to find project");
        }

        // If the user is the owner, disband the team (delete project and all associated mappings)
        if (project.ownerId === userId) {
            await Models.ProjectProjects.deleteOne({ _id: project._id });
            await Models.ProjectMappings.deleteMany({ teamOwnerId: userId });
            return res.status(StatusCode.SuccessOK).send(userId);
        }

        // If the user is not the owner, remove them from the team and delete their mapping
        project.teamMembers = project.teamMembers.filter((member) => member !== userId);
        await project.save();

        await Models.ProjectMappings.deleteOne({ userId });
        return res.status(StatusCode.SuccessOK).send(userId);
    },
);

// GET all projects (STAFF only)
projectRouter.get(
    "/list/",
    specification({
        method: "get",
        path: "/project/list/",
        tag: Tag.PROJECT,
        role: Role.STAFF,
        summary: "Get list of all teams",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The projects",
                schema: ProjectsSchema,
            },
        },
    }),
    async (_, res) => {
        const projects = await Models.ProjectProjects.find();
        return res.status(StatusCode.SuccessOK).send({ projects });
    },
);

// DELETE remove a team member
projectRouter.delete(
    "/member/:userId",
    specification({
        method: "delete",
        path: "/project/member/{userId}",
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
    async (req, res) => {
        const { userId } = req.params;
        const mapping = await Models.ProjectMappings.findOne({ userId });
        if (!mapping) {
            return res.status(StatusCode.ClientErrorNotFound).send(NoTeamFoundError);
        }

        const project = await Models.ProjectProjects.findOne({ ownerId: mapping.teamOwnerId });
        if (!project) {
            return res.status(StatusCode.ClientErrorNotFound).send(NoTeamFoundError);
        }

        // If the user to be removed is the owner, disband the team
        if (project.ownerId === userId) {
            await Models.ProjectProjects.deleteOne({ _id: project._id });
            await Models.ProjectMappings.deleteMany({ teamOwnerId: userId });
            return res.status(StatusCode.SuccessOK).send(userId);
        }

        // Otherwise, remove the user from the team and delete their mapping
        project.teamMembers = project.teamMembers.filter((member) => member !== userId);
        await project.save();

        await Models.ProjectMappings.deleteOne({ userId });
        return res.status(StatusCode.SuccessOK).send(userId);
    },
);

// GET generate access code (owner only)
projectRouter.get(
    "/generate-access-code",
    specification({
        method: "get",
        path: "/project/generate-access-code/",
        tag: Tag.PROJECT,
        role: Role.ATTENDEE, // Ownership is enforced in the handler
        summary: "Generate the team's access code (owner only)",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Access code generated successfully",
                schema: ProjectAccessCodeSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "No project found",
                schema: NoTeamFoundErrorSchema,
            },
            [StatusCode.ClientErrorForbidden]: {
                description: "Forbidden - only project owner can generate access code",
                schema: ForbiddenErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);
        console.log(userId)
        const projectMapping = await Models.ProjectMappings.findOne({ userId });
        if (!projectMapping) {
            return res.status(StatusCode.ClientErrorNotFound).send(NoTeamFoundError);
        }

        // Only the owner is allowed to generate a new access code
        if (projectMapping.teamOwnerId !== userId) {
            return res.status(StatusCode.ClientErrorForbidden).send(ForbiddenError);
        }

        const accessCode = Math.random()
            .toString(RADIX)
            .substring(2, 2 + ACCESS_CODE_LENGTH)
            .toUpperCase();
        const expiryTime = new Date(Date.now() + EXPIRY).toISOString();

        const project = await Models.ProjectProjects.findOne({ ownerId: projectMapping.teamOwnerId });
        if(!project) {
            throw Error("Project not found, despite projectMapping existing");
        }

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
