import { Router } from "express";
import { StatusCode } from "status-code-enum";
import { z } from "zod";
import Models from "../../common/models";
import { SuccessResponseSchema } from "../../common/schemas";
import specification, { Tag } from "../../middleware/specification";
import { Role } from "../auth/auth-schemas";
import {
    JobPostingCreateRequestSchema,
    JobPostingMongoIdSchema,
    JobPostingNotFoundError,
    JobPostingNotFoundErrorSchema,
    JobPostingSchema,
} from "./job-schemas";

const jobRouter = Router();

function serializeJobPosting(posting: {
    _id: unknown;
    companyName: string;
    logoUrl: string;
    jobTitle: string;
    jobDescription: string;
    applicationUrl: string;
}): z.infer<typeof JobPostingSchema> {
    return {
        _id: String(posting._id),
        companyName: posting.companyName,
        logoUrl: posting.logoUrl,
        jobTitle: posting.jobTitle,
        jobDescription: posting.jobDescription,
        applicationUrl: posting.applicationUrl,
    };
}

jobRouter.get(
    "/",
    specification({
        method: "get",
        path: "/job/",
        tag: Tag.JOB,
        role: null,
        summary: "Gets all job postings",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The job postings",
                schema: z.array(JobPostingSchema),
            },
        },
    }),
    async (_req, res) => {
        const postings = await Models.JobPosting.find().sort({ companyName: 1, jobTitle: 1 });
        return res.status(StatusCode.SuccessOK).send(postings.map(serializeJobPosting));
    },
);

jobRouter.post(
    "/",
    specification({
        method: "post",
        path: "/job/",
        tag: Tag.JOB,
        role: Role.ADMIN,
        summary: "Creates a job posting",
        body: JobPostingCreateRequestSchema,
        responses: {
            [StatusCode.SuccessCreated]: {
                description: "The created job posting",
                schema: JobPostingSchema,
            },
        },
    }),
    async (req, res) => {
        const posting = await Models.JobPosting.create(req.body);
        return res.status(StatusCode.SuccessCreated).send(serializeJobPosting(posting));
    },
);

jobRouter.put(
    "/:id/",
    specification({
        method: "put",
        path: "/job/{id}/",
        tag: Tag.JOB,
        role: Role.ADMIN,
        summary: "Updates a job posting",
        parameters: z.object({ id: JobPostingMongoIdSchema }),
        body: JobPostingCreateRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The updated job posting",
                schema: JobPostingSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Failed to find the job posting requested",
                schema: JobPostingNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const posting = await Models.JobPosting.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!posting) {
            return res.status(StatusCode.ClientErrorNotFound).send(JobPostingNotFoundError);
        }
        return res.status(StatusCode.SuccessOK).send(serializeJobPosting(posting));
    },
);

jobRouter.delete(
    "/:id/",
    specification({
        method: "delete",
        path: "/job/{id}/",
        tag: Tag.JOB,
        role: Role.ADMIN,
        summary: "Deletes a job posting",
        parameters: z.object({ id: JobPostingMongoIdSchema }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Successfully deleted",
                schema: SuccessResponseSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Failed to find the job posting requested",
                schema: JobPostingNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const posting = await Models.JobPosting.findByIdAndDelete(req.params.id);
        if (!posting) {
            return res.status(StatusCode.ClientErrorNotFound).send(JobPostingNotFoundError);
        }
        return res.status(StatusCode.SuccessOK).send({ success: true });
    },
);

export default jobRouter;
