import { StatusCode } from "status-code-enum";
import { Router } from "express";
import Config from "../../common/config";
import Models from "../../common/models";
import { Role } from "../auth/auth-schemas";
import specification, { Tag } from "../../middleware/specification";
import { z } from "zod";
import {
    CreateSponsorRequestSchema,
    DeleteSponsorRequestSchema,
    ResumeBookEntrySchema,
    ResumeBookFilterSchema,
    SponsorNotFoundError,
    SponsorNotFoundErrorSchema,
    SponsorSchema,
} from "./sponsor-schemas";
import crypto from "crypto";
import { SuccessResponseSchema } from "../../common/schemas";

const sponsorRouter = Router();

sponsorRouter.get(
    "/",
    specification({
        method: "get",
        path: "/sponsor/",
        tag: Tag.SPONSOR,
        role: Role.ADMIN,
        summary: "Gets all sponsors",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "All sponsors",
                schema: z.array(SponsorSchema),
            },
        },
    }),
    async (_req, res) => {
        const sponsors = await Models.Sponsor.find();

        return res.status(StatusCode.SuccessOK).send(sponsors);
    },
);

sponsorRouter.post(
    "/",
    specification({
        method: "post",
        path: "/sponsor/",
        tag: Tag.SPONSOR,
        role: Role.ADMIN,
        summary: "Creates a sponsor",
        body: CreateSponsorRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The newly created sponsor",
                schema: SponsorSchema,
            },
        },
    }),
    async (req, res) => {
        const { email } = req.body;
        const userId = "sponsor" + crypto.randomBytes(Config.EVENT_BYTES_GEN).toString("hex");
        const created = await Models.Sponsor.create({
            userId,
            email,
        });

        return res.status(StatusCode.SuccessOK).send(created);
    },
);

sponsorRouter.delete(
    "/",
    specification({
        method: "delete",
        path: "/sponsor/",
        tag: Tag.SPONSOR,
        role: Role.ADMIN,
        summary: "Deletes a sponsor",
        body: DeleteSponsorRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Successfully deleted",
                schema: SuccessResponseSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Sponsor not found",
                schema: SponsorNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { userId } = req.body;
        const result = await Models.Sponsor.findOneAndDelete({
            userId,
        });

        if (!result) {
            return res.status(StatusCode.ClientErrorNotFound).send(SponsorNotFoundError);
        }

        return res.status(StatusCode.SuccessOK).send({ success: true });
    },
);

sponsorRouter.post(
    "/resumebook/filter/pagecount",
    specification({
        method: "post",
        path: "/sponsor/resumebook/filter/pagecount",
        tag: Tag.SPONSOR,
        role: Role.SPONSOR,
        summary: "Counts admitted applicants matching filter criteria and returns page count.",
        body: ResumeBookFilterSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Total number of pages based on ENTRIES_PER_PAGE.",
                schema: z.object({ pageCount: z.number() }),
            },
        },
    }),
    async (req, res) => {
        const { graduations, majors, degrees } = req.body;

        // convert graduation values to integers
        const graduationInts = graduations.map((grad) => parseInt(grad, 10));

        // get all accepted user ids
        const admissionDecisionQuery = { response: "ACCEPTED", status: "ACCEPTED" };
        const acceptedUserDocuments = await Models.AdmissionDecision.find(admissionDecisionQuery);
        const acceptedUserIds = acceptedUserDocuments.map((doc) => doc.userId);

        interface RegistrationQuery {
            userId?: { $in: string[] };
            gradYear?: { $in: number[] };
            major?: { $in: string[] };
            degree?: { $in: string[] };
        }

        // Build query object with conditional spreads
        const registrationQuery: RegistrationQuery = {
            userId: { $in: acceptedUserIds },
            ...(graduations?.length && { gradYear: { $in: graduationInts } }),
            ...(majors?.length && { major: { $in: majors } }),
            ...(degrees?.length && { degree: { $in: degrees } }),
        };

        // query registration_applications database and count documents with filter values from req body
        const filteredApplicantCount = await Models.RegistrationApplication.countDocuments(registrationQuery);

        // Calculate the number of pages based on the configured entries per page (config value)
        const pageCount = Math.ceil(filteredApplicantCount / Config.RESUME_BOOK_ENTRIES_PER_PAGE);
        return res.status(StatusCode.SuccessOK).send({ pageCount });
    },
);

sponsorRouter.post(
    "/resumebook/filter/:page",
    specification({
        method: "post",
        path: "/sponsor/resumebook/filter/{page}",
        tag: Tag.SPONSOR,
        role: Role.SPONSOR,
        summary: "Returns a page of admitted applicants matching filter criteria.",
        parameters: z.object({
            page: z.preprocess((val) => Number(val), z.number()),
        }),
        body: ResumeBookFilterSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The list of admitted applicants for the specified page.",
                schema: z.array(ResumeBookEntrySchema),
            },
            [StatusCode.ClientErrorBadRequest]: {
                description: "Invalid page number or filter criteria.",
                schema: z.object({ error: z.string() }),
            },
        },
    }),
    async (req, res) => {
        const { graduations, majors, degrees } = req.body;
        const page = req.params.page;

        if (page < 1) {
            return res.status(StatusCode.ClientErrorBadRequest).send({ error: "Invalid page number." });
        }

        // convert graduation values to integers
        const graduationInts = graduations.map((grad) => parseInt(grad, 10));

        // get all accepted user ids
        const admissionDecisionQuery = { response: "ACCEPTED", status: "ACCEPTED" };
        const acceptedUserDocuments = await Models.AdmissionDecision.find(admissionDecisionQuery);
        const acceptedUserIds = acceptedUserDocuments.map((doc) => doc.userId);

        interface RegistrationQuery {
            userId?: { $in: string[] };
            gradYear?: { $in: number[] };
            major?: { $in: string[] };
            degree?: { $in: string[] };
        }

        // Build query object with conditional spreads
        const registrationQuery: RegistrationQuery = {
            userId: { $in: acceptedUserIds },
            ...(graduations?.length && { gradYear: { $in: graduationInts } }),
            ...(majors?.length && { major: { $in: majors } }),
            ...(degrees?.length && { degree: { $in: degrees } }),
        };

        // query registration_applications database and return page of document values with filter values from req body
        const filteredApplicants = await Models.RegistrationApplication.find(registrationQuery)
            .select({ _id: 0, userId: 1, legalName: 1, major: 1, minor: 1, degree: 1, gradYear: 1, emailAddress: 1 })
            .skip((page - 1) * Config.RESUME_BOOK_ENTRIES_PER_PAGE)
            .limit(Config.RESUME_BOOK_ENTRIES_PER_PAGE);

        return res.status(StatusCode.SuccessOK).send(filteredApplicants);
    },
);

export default sponsorRouter;
