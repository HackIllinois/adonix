import { Router } from "express";

import { Role } from "../auth/auth-schemas";
import {
    DecisionStatus,
    DecisionResponse,
    AdmissionDecisionsSchema,
    DecisionNotAcceptedErrorSchema,
    DecisionNotAcceptedError,
    DecisionAlreadyRSVPdError,
    DecisionAlreadyRSVPdErrorSchema,
    DecisionNotFoundError,
    DecisionNotFoundErrorSchema,
    AdmissionDecisionSchema,
    AdmissionDecisionUpdatesSchema,
    ProfileDataRequiredError,
    ProfileDataRequiredErrorSchema,
    ApplicationReviewSummariesSchema,
    ApplicationReviewSummary,
} from "./admission-schemas";
import Models from "../../common/models";
import { getAuthenticatedUser } from "../../common/auth";
import { StatusCode } from "status-code-enum";
import Config, { Templates } from "../../common/config";
import { sendBulkMail, sendMail } from "../mail/mail-lib";
import specification, { Tag } from "../../middleware/specification";
import { z } from "zod";
import { SuccessResponseSchema, UserIdSchema } from "../../common/schemas";
import {
    ApplicationReviewRequestSchema,
    NoApplicationsToReviewError,
    NoApplicationsToReviewErrorSchema,
    RegistrationApplicationSubmittedSchema,
    RegistrationNotFoundError,
    RegistrationNotFoundErrorSchema,
} from "../registration/registration-schemas";
import {
    AttendeeProfileCreateRequestSchema,
    AttendeeProfileAlreadyExistsError,
    AttendeeProfileAlreadyExistsErrorSchema,
} from "../profile/profile-schemas";
import { getAvatarUrlForId, assignTeamByUserId } from "../profile/profile-lib";

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
    "/accept/",
    specification({
        method: "put",
        path: "/admission/accept/",
        tag: Tag.ADMISSION,
        role: Role.USER,
        summary: "RSVP with an accept decision",
        body: AttendeeProfileCreateRequestSchema,
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
            [StatusCode.ClientErrorBadRequest]: [
                {
                    id: AttendeeProfileAlreadyExistsError.error,
                    description: "Profile already exists",
                    schema: AttendeeProfileAlreadyExistsErrorSchema,
                },
                {
                    id: ProfileDataRequiredError.error,
                    description: "Profile data required when accepting",
                    schema: ProfileDataRequiredErrorSchema,
                },
            ],
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
        const application = await Models.RegistrationApplicationSubmitted.findOne({ userId });
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

        const { avatarId, discordTag, displayName, dietaryRestrictions, shirtSize } = req.body;
        const existingProfile = await Models.AttendeeProfile.findOne({ userId });
        if (existingProfile) {
            return res.status(StatusCode.ClientErrorBadRequest).send(AttendeeProfileAlreadyExistsError);
        }

        const { team, teamBadge } = await assignTeamByUserId(userId);

        const profile = {
            userId,
            discordTag,
            displayName,
            avatarUrl: getAvatarUrlForId(avatarId),
            points: Config.DEFAULT_POINT_VALUE,
            pointsAccumulated: Config.DEFAULT_POINT_VALUE,
            foodWave: dietaryRestrictions.filter((res) => res.toLowerCase() != "none").length > 0 ? 1 : 2,
            dietaryRestrictions,
            shirtSize,
            team,
            teamBadge,
        };

        await Models.AttendeeProfile.create(profile);

        const updatedDecision = await Models.AdmissionDecision.findOneAndUpdate(
            { userId },
            { response: DecisionResponse.ACCEPTED },
            { new: true },
        );

        if (!updatedDecision) {
            throw Error("Failed to update decision");
        }

        if (admissionDecision.admittedPro) {
            await Models.AuthInfo.updateOne({ userId }, { $push: { roles: { $each: [Role.PRO, Role.ATTENDEE] } } });
        } else {
            await Models.AuthInfo.updateOne({ userId }, { $push: { roles: { $each: [Role.ATTENDEE] } } });
        }

        // Send email
        await sendMail(Templates.RSVP_ACCEPTED, application.email, {
            name: application.preferredName || application.firstName,
        });

        // We did it!
        return res.status(StatusCode.SuccessOK).send(updatedDecision);
    },
);

admissionRouter.put(
    "/decline/",
    specification({
        method: "put",
        path: "/admission/rsvp/{decision}/",
        tag: Tag.ADMISSION,
        role: Role.USER,
        summary: "RSVP with a decline decision",
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
        const application = await Models.RegistrationApplicationSubmitted.findOne({ userId });
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

        const updatedDecision = await Models.AdmissionDecision.findOneAndUpdate(
            { userId },
            { response: DecisionResponse.DECLINED },
            { new: true },
        );

        if (!updatedDecision) {
            throw Error("Failed to update decision");
        }

        // Send email
        await sendMail(Templates.RSVP_DECLINED, application.email);

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
        body: AdmissionDecisionUpdatesSchema,
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

        // Get all existing decisions
        const userIds = updateEntries.map((entry) => entry.userId);
        const existingDecisionsList = await Models.AdmissionDecision.find({ userId: { $in: userIds } });
        const existingDecisions = new Map(existingDecisionsList.map((decision) => [decision.userId, decision]));

        // Fetch the ones that have had their status changed
        const changedEntries = updateEntries.filter((entry) => existingDecisions.get(entry.userId)?.status !== entry.status);
        const changedUserIds = changedEntries.map((entry) => entry.userId);

        const applicationsList = await Models.RegistrationApplicationSubmitted.find({ userId: { $in: changedUserIds } }).select({
            userId: 1,
            preferredName: 1,
            firstName: 1,
            email: 1,
        });
        const applicationMap = new Map(
            applicationsList.map((app) => [app.userId, { name: app.preferredName || app.firstName, email: app.email }]),
        );

        const entriesWithEmails = changedEntries.map((entry) => {
            const application = applicationMap.get(entry.userId);

            return {
                ...entry,
                name: application?.name ?? "",
                email: application?.email ?? "",
            };
        });

        const operations = entriesWithEmails.map((entry) => {
            const update = {
                updateOne: {
                    filter: { userId: entry.userId },
                    update: {
                        $set: {
                            status: entry.status,
                            reimbursementValue: entry.reimbursementValue,
                            admittedPro: entry.admittedPro,
                            emailSent: true,
                        },
                    },
                    upsert: true,
                },
            };

            const recipient = {
                email: entry.email,
                data: {
                    name: entry.name,
                    isAccepted: entry.status === DecisionStatus.ACCEPTED,
                    reimbursementValue: entry.reimbursementValue || false,
                    pro: entry.admittedPro,
                },
            };

            return { update, recipient };
        });

        // Perform all updates
        await Models.AdmissionDecision.bulkWrite(operations.map((operation) => operation.update));

        // Send mail
        await sendBulkMail(
            Templates.STATUS_UPDATE,
            operations.map((operation) => operation.recipient),
            { name: "", isAccepted: false, reimbursementValue: false, pro: false },
        );

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

admissionRouter.get(
    "/review/",
    specification({
        method: "get",
        path: "/admission/review/",
        tag: Tag.ADMISSION,
        role: Role.STAFF,
        summary: "Gets the number of reviews and average score for every submitted application",
        description: "Only scored reviews are counted - applications assigned to a reviewer but not yet scored are excluded.",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The review summaries",
                schema: ApplicationReviewSummariesSchema,
            },
        },
    }),
    async (_req, res) => {
        const summaries = await Models.RegistrationApplicationSubmitted.aggregate<ApplicationReviewSummary>([
            {
                $project: {
                    _id: 0,
                    userId: 1,
                    scores: {
                        $filter: {
                            input: { $ifNull: ["$reviews.score", []] },
                            cond: { $isNumber: "$$this" },
                        },
                    },
                },
            },
            {
                $project: {
                    userId: 1,
                    reviewCount: { $size: "$scores" },
                    averageScore: { $avg: "$scores" },
                },
            },
        ]);
        return res.status(StatusCode.SuccessOK).send(summaries);
    },
);

admissionRouter.get(
    "/review/next/",
    specification({
        method: "get",
        path: "/admission/review/next/",
        tag: Tag.ADMISSION,
        role: Role.STAFF,
        summary: "Gets the next application for the currently authenticated staff member to review",
        description:
            "If you were already assigned an application and haven't scored it yet, that application is returned again.\n" +
            "Otherwise, you are assigned the application with the fewest reviews that you haven't reviewed.",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The application to review",
                schema: RegistrationApplicationSubmittedSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "No applications left to review",
                schema: NoApplicationsToReviewErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: reviewerId } = getAuthenticatedUser(req);

        // Resume the application they were already assigned, if any
        const pending = await Models.RegistrationApplicationSubmitted.findOne({
            reviews: { $elemMatch: { reviewerId, score: null } },
        }).lean();
        if (pending) {
            return res.status(StatusCode.SuccessOK).send(pending);
        }

        // Otherwise, atomically assign the least reviewed application they haven't reviewed
        const assigned = await Models.RegistrationApplicationSubmitted.findOneAndUpdate(
            { "reviews.reviewerId": { $ne: reviewerId } },
            { $push: { reviews: { reviewerId, score: null } }, $inc: { reviewCount: 1 } },
            { sort: { reviewCount: 1 }, new: true, lean: true },
        );
        if (!assigned) {
            return res.status(StatusCode.ClientErrorNotFound).send(NoApplicationsToReviewError);
        }

        return res.status(StatusCode.SuccessOK).send(assigned);
    },
);

admissionRouter.put(
    "/review/:id/",
    specification({
        method: "put",
        path: "/admission/review/{id}/",
        tag: Tag.ADMISSION,
        role: Role.STAFF,
        summary: "Submits the currently authenticated staff member's score for the specified user's application",
        description: "Submitting again for the same application replaces your previous score.",
        parameters: z.object({
            id: UserIdSchema,
        }),
        body: ApplicationReviewRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Successfully submitted",
                schema: SuccessResponseSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Couldn't find the application",
                schema: RegistrationNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: reviewerId } = getAuthenticatedUser(req);
        const { id: userId } = req.params;
        const { score } = req.body;

        // Update their existing review (assigned or already scored)
        const updated = await Models.RegistrationApplicationSubmitted.updateOne(
            { userId, "reviews.reviewerId": reviewerId },
            { $set: { "reviews.$.score": score } },
        );
        if (updated.matchedCount > 0) {
            return res.status(StatusCode.SuccessOK).send({ success: true });
        }

        // Otherwise add a new review, guarded so a concurrent request can't add a second one
        const added = await Models.RegistrationApplicationSubmitted.updateOne(
            { userId, "reviews.reviewerId": { $ne: reviewerId } },
            { $push: { reviews: { reviewerId, score } }, $inc: { reviewCount: 1 } },
        );
        if (added.matchedCount > 0) {
            return res.status(StatusCode.SuccessOK).send({ success: true });
        }

        // Neither matched: either there is no application, or a concurrent request just added the review
        const exists = await Models.RegistrationApplicationSubmitted.exists({ userId });
        if (!exists) {
            return res.status(StatusCode.ClientErrorNotFound).send(RegistrationNotFoundError);
        }
        await Models.RegistrationApplicationSubmitted.updateOne(
            { userId, "reviews.reviewerId": reviewerId },
            { $set: { "reviews.$.score": score } },
        );
        return res.status(StatusCode.SuccessOK).send({ success: true });
    },
);

export default admissionRouter;
