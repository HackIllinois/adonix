import { z } from "zod";
import { prop } from "@typegoose/typegoose"; 
import { UserIdSchema } from "../../common/schemas";

// path enum
export enum PathType {
    BEGINNER = "BEGINNER",
    GENERAL = "GENERAL",
    PRO = "PRO"
}
export const PathTypeSchema = z.nativeEnum(PathType);

// track enum
export enum TrackType {
    SPONSOR_1 = "SPONSOR1",
    SPONSOR_2 = "SPONSOR2",
    SPONSOR_3 = "SPONSOR3"
}
export const TrackTypeSchema = z.nativeEnum(TrackType);

// general interface for a project
export class Project {
    @prop({ required: true})
    public projectName: string;

    @prop({required: true})
    public ownerId: string

    @prop({
        required: true,
        type: () => String
    })
    public teamMembers: string[]

    @prop({
        required: true,
        enum: PathType
    })
    public path: PathType

    @prop({
        required: true,
        enum: TrackType
    })
    public track: TrackType

    @prop({required: true})
    public githubLink: string

    @prop({required: true})
    public videoLink: string

    @prop({required: true})
    public accessCode: string

    @prop({required: false})
    public description: string

}

// interface for ownerId to userId mapping
export class ProjectMapping {
    @prop({required: true})
    public teamOwnerId: string

    @prop({required: true})
    public userId: string
}

export const ProjectSchema = z
    .object({
        projectName: z.string(),
        ownerId: UserIdSchema,
        teamMembers: z.array(UserIdSchema),
        path: PathTypeSchema,
        track: TrackTypeSchema,
        githubLink: z.string(),
        videoLink: z.string(),
        accessCode: z.string(),
        description: z.string().optional()
    })
    .openapi("ProjectSchema", {
        description: "Information about a project"
    })

export const ProjectMappingSchema = z
    .object({
        teamOwnerId: UserIdSchema,
        userId: UserIdSchema,
    })
    .openapi("ProjectMappingSchema", {
        description: "Mapping team owner's ID to their teammates' userIDs"
    })

export const ProjectsSchema = z
    .object({
        projects: z.array(ProjectSchema)
    })
    .openapi("ProjectsSchema", {
        description: "all projects"
    })