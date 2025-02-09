import { z } from "zod";
import { prop } from "@typegoose/typegoose";
import { UserIdSchema } from "../../common/schemas";
import { CreateErrorAndSchema } from "../../common/schemas";

// path enum
export enum PathType {
    GENERAL = "GENERAL",
    PRO = "PRO",
}
export const PathTypeSchema = z.nativeEnum(PathType);

// track enum
export enum TrackType {
    SPONSOR_1 = "SPONSOR1",
    SPONSOR_2 = "SPONSOR2",
    SPONSOR_3 = "SPONSOR3",
}
export const TrackTypeSchema = z.nativeEnum(TrackType);

// general interface for a project - change some to be false?
export class Project {
    @prop({ required: true })
    public projectName: string;

    @prop({ required: true })
    public ownerId: string;

    @prop({
        required: true,
        type: () => String,
    })
    public teamMembers: string[];

    @prop({
        required: true,
        enum: PathType,
    })
    public path: PathType;

    @prop({
        required: true,
        enum: TrackType,
    })
    public track: TrackType;

    @prop({ required: true })
    public githubLink: string;

    @prop({ required: true })
    public videoLink: string;

    @prop({ required: true })
    public accessCode: string;

    @prop({ required: true })
    public expiryTime: string;

    @prop({ required: false })
    public description: string;
}

// interface for ownerId to userId mapping
export class ProjectMappings {
    @prop({ required: true })
    public teamOwnerId: string;

    @prop({ required: true })
    public userId: string;
}

export const ProjectProjectsSchema = z
    .object({
        projectName: z.string(),
        ownerId: UserIdSchema,
        teamMembers: z.array(UserIdSchema),
        path: PathTypeSchema,
        track: TrackTypeSchema,
        githubLink: z.string(),
        videoLink: z.string(),
        accessCode: z.string(),
        expiryTime: z.string(),
        description: z.string(),
    })
    .openapi("ProjectSchema", {
        description: "Information about a project",
    });

export const CreateProjectRequestSchema = ProjectProjectsSchema.omit({
    ownerId: true,
    accessCode: true,
    expiryTime: true,
}).openapi("CreateProjectRequest"); // add example after

export const AccessCodeSchema = z
    .object({
        accessCode: z.string(),
    })
    .openapi("AccessCodeSchema", {
        description: "Access code for joining a team",
    });

export const ProjectMappingsSchema = z
    .object({
        teamOwnerId: UserIdSchema,
        userId: UserIdSchema,
    })
    .openapi("ProjectMappingSchema", {
        description: "A user's team/teamOwnerId",
    });

export const ProjectsSchema = z
    .object({
        projects: z.array(ProjectProjectsSchema),
    })
    .openapi("ProjectsSchema", {
        description: "all projects",
    });

export const ProjectUpdateSchema = ProjectProjectsSchema.omit({
    ownerId: true,
    accessCode: true,
    teamMembers: true,
    expiryTime: true,
})
    .partial()
    .merge(ProjectProjectsSchema.pick({ ownerId: true }))
    .openapi("ProjectUpdateSchema", {
        description: "Update project - owner only",
        example: {
            ownerId: "owner123",
            projectName: "Updated Project Name",
        },
    });

export const ProjectAccessCodeSchema = z
    .object({
        ownerId: z.string(),
        accessCode: z.string(),
        expiryTime: z.string(), // ISO string format
    })
    .openapi("ProjectAccessCodeSchema", {
        description: "Generate access code schema",
    });

export const [UserHasConflictError, UserHasConflictErrorSchema] = CreateErrorAndSchema({
    error: "UserConflict",
    message: "This user's path/track doesn't match, or they're already in a team!",
});

export const [NoTeamFoundError, NoTeamFoundErrorSchema] = CreateErrorAndSchema({
    error: "NoTeamFound",
    message: "No team was found for this user",
});

export const [ForbiddenError, ForbiddenErrorSchema] = CreateErrorAndSchema({
    error: "Unauthorized",
    message: "User is not authorized i.e. not owner/team-member/staff",
});

export const [InvalidAccessCodeError, InvalidAccessCodeErrorSchema] = CreateErrorAndSchema({
    error: "InvalidAccessCode",
    message: "The provided access code is invalid or has expired.",
});

export const [TeamFullError, TeamFullErrorSchema] = CreateErrorAndSchema({
    error: "TeamFull",
    message: "The team is already full.",
});

export const [TrackConflictError, TrackConflictErrorSchema] = CreateErrorAndSchema({
    error: "TrackConflict",
    message: "Your track does not match the team's track.",
});

export const [PathConflictError, PathConflictErrorSchema] = CreateErrorAndSchema({
    error: "PathConflict",
    message: "Your path does not match the team's path.",
});
