import { Router } from "express";
//import { Role } from "../auth/auth-schemas";

import { StatusCode } from "status-code-enum";

import specification, { Tag } from "../../middleware/specification";

import {
    //ProjectSchema,
    ProjectsSchema,
    //ProjectMappingSchema,
    //PathTypeSchema,
    //TrackTypeSchema
} from './projects-schema'

//import { EventIdSchema, SuccessResponseSchema } from "../../common/schemas";
//import { z } from "zod";
import Models from "../../common/models";
//import { tryGetAuthenticatedUser } from "../../common/auth";
//import Config from "../../common/config";
//import crypto from "crypto";

const projectRouter = Router();

projectRouter.get(
    "/list/",
    specification({
        method: "get",
        path: "/projects/list/",
        tag: Tag.PROJECTS,
        role: null, //staff only endpoint
        summary: "get list of all teams",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The projects",
                schema: ProjectsSchema,
            },
        },
    }),
    async(_req, res) => {
        const projects = await Models.Projects.find();
        return res.status(StatusCode.SuccessOK).send({ projects: projects });
    },
);

export default projectRouter;