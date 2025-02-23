import { StatusCode } from "status-code-enum";
import { Router } from "express";

import Config from "../../common/config";

import Models from "../../common/models";
import { RegistrationApplicationSchema } from "./../registration/registration-schemas";

import { ResumeBookFilterCriteriaSchema } from "./resumebook-schemas";

import { Role } from "../auth/auth-schemas";

import specification, { Tag } from "../../middleware/specification";
import { z } from "zod";

const resumebookRouter = Router();

// POST /registration/filter/pagecount
// - Expects a filter object in the body containing arrays for graduations, majors, and degrees.
// - Counts the number of admitted applicants that match the filter and calculates
//   the total number of pages based on the ENTRIES_PER_PAGE config value.
resumebookRouter.post(
    "/filter/pagecount",
    specification({
        method: "post",
        path: "/resumebook/filter/pagecount",
        tag: Tag.RESUMEBOOK,
        role: Role.STAFF,
        summary: "Counts admitted applicants matching filter criteria and returns page count.",
        body: ResumeBookFilterCriteriaSchema,
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

// POST /registration/filter/:page
// - Expects a filter object in the body containing arrays for graduations, majors, and degrees.
// - Returns the specific page of admitted applicants (using ENTRIES_PER_PAGE for the number per page).
resumebookRouter.post(
    "/filter/:page",
    specification({
        method: "post",
        path: "/resumebook/filter/{page}",
        tag: Tag.RESUMEBOOK,
        role: Role.STAFF,
        summary: "Returns a page of admitted applicants matching filter criteria.",
        parameters: z.object({
            page: z.preprocess((val) => Number(val), z.number().min(1)),
        }),
        body: ResumeBookFilterCriteriaSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The list of admitted applicants for the specified page.",
                // Here we assume each applicant document conforms to RegistrationApplicationSchema.
                schema: z.array(RegistrationApplicationSchema),
            },
        },
    }),
    async (req, res) => {
        const { graduations, majors, degrees } = req.body;
        const page = req.params.page;

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
            .select({ legalName: 1, major: 1, minor: 1, degree: 1, gradYear: 1, emailAddress: 1 })
            .skip((page - 1) * Config.RESUME_BOOK_ENTRIES_PER_PAGE)
            .limit(Config.RESUME_BOOK_ENTRIES_PER_PAGE);

        return res.status(StatusCode.SuccessOK).send(filteredApplicants);
    },
);

export default resumebookRouter;