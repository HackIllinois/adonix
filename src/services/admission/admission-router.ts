import { Router } from "express";

import { Role } from "../auth/auth-schemas";
import {
    DecisionStatus,
    DecisionResponse,
    AdmissionDecisionsSchema,
    DecisionNotAcceptedErrorSchema,
    DecisionNotAcceptedError,
    DecisionRequestSchema,
    DecisionAlreadyRSVPdError,
    DecisionAlreadyRSVPdErrorSchema,
    DecisionNotFoundError,
    DecisionNotFoundErrorSchema,
    AdmissionDecisionSchema,
} from "./admission-schemas";
import Models from "../../common/models";
import { getAuthenticatedUser } from "../../common/auth";
import { StatusCode } from "status-code-enum";
import { MailInfo } from "../mail/mail-schemas";
import { RegistrationTemplates } from "../../common/config";
import { sendMail } from "../mail/mail-lib";
import specification, { Tag } from "../../middleware/specification";
import { z } from "zod";
import { SuccessResponseSchema, UserIdSchema } from "../../common/schemas";
import { RegistrationNotFoundError, RegistrationNotFoundErrorSchema } from "../registration/registration-schemas";

const admissionRouter = Router();

admissionRouter.get(
    "/notsent/",
    specification({
        method: "get",
        path: "/admission/notsent/",
        tag: Tag.ADMISSION,
        role: Role.STAFF,
        summary: "Gets all admission decisions that have not had an email sent yet",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The decisions",
                schema: AdmissionDecisionsSchema,
            },
        },
    }),
    async (_req, res) => {
        const notSentDecisions = await Models.AdmissionDecision.find({ emailSent: false });
        return res.status(StatusCode.SuccessOK).send(notSentDecisions);
    },
);

admissionRouter.put(
    "/rsvp/:decision/",
    specification({
        method: "put",
        path: "/admission/rsvp/{decision}/",
        tag: Tag.ADMISSION,
        role: Role.USER,
        summary: "RSVP with a accept or decline decision",
        parameters: z.object({
            decision: DecisionRequestSchema,
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The updated decision",
                schema: AdmissionDecisionSchema,
            },
            [StatusCode.ClientErrorNotFound]: [
                {
                    id: DecisionNotFoundError.error,
                    description: "Couldn't find user's decision",
                    schema: DecisionNotFoundErrorSchema,
                },
                {
                    id: RegistrationNotFoundError.error,
                    description: "Couldn't find user's application",
                    schema: RegistrationNotFoundErrorSchema,
                },
            ],
            [StatusCode.ClientErrorForbidden]: {
                description: "Not accepted so can't make a decision",
                schema: DecisionNotAcceptedErrorSchema,
            },
            [StatusCode.ClientErrorConflict]: {
                description: "Already RSVPd",
                schema: DecisionAlreadyRSVPdErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);

        // Verify they have a decision
        const admissionDecision = await Models.AdmissionDecision.findOne({ userId: userId });
        if (!admissionDecision) {
            return res.status(StatusCode.ClientErrorNotFound).send(DecisionNotFoundError);
        }

        // Verify they have an application
        const application = await Models.RegistrationApplication.findOne({ userId });
        if (!application) {
            return res.status(StatusCode.ClientErrorNotFound).send(RegistrationNotFoundError);
        }

        // Must be accepted to make a decision
        if (admissionDecision.status != DecisionStatus.ACCEPTED) {
            return res.status(StatusCode.ClientErrorForbidden).send(DecisionNotAcceptedError);
        }

        // Cannot have already made a decision
        if (admissionDecision.response != DecisionResponse.PENDING) {
            return res.status(StatusCode.ClientErrorConflict).send(DecisionAlreadyRSVPdError);
        }

        // They can make a decision! Handle what they chose:
        const response = req.params.decision === "accept" ? DecisionResponse.ACCEPTED : DecisionResponse.DECLINED;
        const updatedDecision = await Models.AdmissionDecision.findOneAndUpdate({ userId }, { response }, { new: true });

        if (!updatedDecision) {
            throw Error("Failed to update decision");
        }

        // Send email
        let mailInfo: MailInfo;
        if (response == DecisionResponse.ACCEPTED) {
            if (admissionDecision.admittedPro) {
                await Models.AuthInfo.updateOne({ userId }, { $push: { roles: { $each: [Role.PRO, Role.ATTENDEE] } } });
            } else {
                await Models.AuthInfo.updateOne({ userId }, { $push: { roles: { $each: [Role.ATTENDEE] } } });
            }
            if (application.requestedTravelReimbursement && (admissionDecision.reimbursementValue ?? 0) > 0) {
                mailInfo = {
                    templateId: RegistrationTemplates.RSVP_CONFIRMATION_WITH_REIMBURSE,
                    recipients: [application.emailAddress],
                    subs: { name: application.preferredName, amount: admissionDecision.reimbursementValue },
                };
            } else {
                mailInfo = {
                    templateId: RegistrationTemplates.RSVP_CONFIRMATION,
                    recipients: [application.emailAddress],
                    subs: { name: application.preferredName },
                };
            }
        } else {
            mailInfo = {
                templateId: RegistrationTemplates.RSVP_DECLINED,
                recipients: [application.emailAddress],
            };
        }

        await sendMail(mailInfo);

        // We did it!
        return res.status(StatusCode.SuccessOK).send(updatedDecision);
    },
);

admissionRouter.put(
    "/update/",
    specification({
        method: "put",
        path: "/admission/update/",
        tag: Tag.ADMISSION,
        role: Role.STAFF,
        summary: "Updates the decision status of specified applicants",
        body: AdmissionDecisionsSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Successfully updated",
                schema: SuccessResponseSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "A applicant's application was not found",
                schema: RegistrationNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const updateEntries = req.body;

        // collect emails whose status changed from TBD -> NON-TBD
        const recipients: string[] = [];
        for (const entry of updateEntries) {
            const { userId, status } = entry;
            const existingDecision = await Models.AdmissionDecision.findOne({ userId });
            if (existingDecision?.status === DecisionStatus.TBD && status !== DecisionStatus.TBD) {
                const application = await Models.RegistrationApplication.findOne({ userId: existingDecision.userId });
                if (!application) {
                    return res.status(StatusCode.ClientErrorNotFound).send(RegistrationNotFoundError);
                }
                recipients.push(application.emailAddress);
            }
        }

        const ops = updateEntries.map((entry) =>
            Models.AdmissionDecision.findOneAndUpdate(
                { userId: entry.userId },
                {
                    $set: {
                        status: entry.status,
                        admittedPro: entry.admittedPro,
                        emailSent: true,
                        reimbursementValue: entry.reimbursementValue,
                    },
                },
            ),
        );

        await Promise.all(ops);

        const mailInfo: MailInfo = {
            templateId: RegistrationTemplates.STATUS_UPDATE,
            recipients: recipients,
        };
        await sendMail(mailInfo);
        return res.status(StatusCode.SuccessOK).send({ success: true });
    },
);

admissionRouter.get(
    "/rsvp/",
    specification({
        method: "get",
        path: "/admission/rsvp/",
        tag: Tag.ADMISSION,
        role: Role.USER,
        summary: "Gets admission rsvp information for the current user",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The admission rsvp information",
                schema: AdmissionDecisionSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Admission rsvp was not found",
                schema: DecisionNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);

        const admissionDecision = await Models.AdmissionDecision.findOne({ userId });
        if (!admissionDecision) {
            return res.status(StatusCode.ClientErrorNotFound).send(DecisionNotFoundError);
        }

        return res.status(StatusCode.SuccessOK).send(admissionDecision);
    },
);

admissionRouter.get(
    "/rsvp/staff/",
    specification({
        method: "get",
        path: "/admission/rsvp/staff/",
        tag: Tag.ADMISSION,
        role: Role.STAFF,
        summary: "Gets admission rsvps for all users",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "All admission rsvps",
                schema: AdmissionDecisionsSchema,
            },
        },
    }),
    async (_req, res) => {
        const admissionDecisions = await Models.AdmissionDecision.find();
        return res.status(StatusCode.SuccessOK).send(admissionDecisions);
    },
);

admissionRouter.get(
    "/rsvp/:id/",
    specification({
        method: "get",
        path: "/admission/rsvp/{id}/",
        tag: Tag.ADMISSION,
        role: Role.STAFF,
        summary: "Gets admission rsvp information for the specified user",
        parameters: z.object({
            id: UserIdSchema,
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The admission rsvp information",
                schema: AdmissionDecisionSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Admission rsvp was not found",
                schema: DecisionNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = req.params;

        const admissionDecision = await Models.AdmissionDecision.findOne({ userId: userId });
        if (!admissionDecision) {
            return res.status(StatusCode.ClientErrorNotFound).send(DecisionNotFoundError);
        }

        return res.status(StatusCode.SuccessOK).send(admissionDecision);
    },
);

export default admissionRouter;
