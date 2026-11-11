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
    ApplicationReviewerRequestSchema,
    ReviewAlreadyScoredError,
    ReviewAlreadyScoredErrorSchema,
    ApplicantsQuerySchema,
    ApplicantsEmailsQuerySchema,
    ApplicantsSchema,
    ApplicantEmailsSchema,
    ApplicantTagUpdateRequestSchema,
    ApplicantTagUpdateResponseSchema,
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
    ApplicationReviewDetailsSchema,
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
import { getApplicantTag, getDecisionFieldsForTag, getNextReviewApplication, listApplicants } from "./admission-lib";

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

        // Claim the RSVP atomically so concurrent requests can't both act on it
        const updatedDecision = await Models.AdmissionDecision.findOneAndUpdate(
            { userId, status: DecisionStatus.ACCEPTED, response: DecisionResponse.PENDING },
            { response: DecisionResponse.ACCEPTED },
            { new: true },
        );
        if (!updatedDecision) {
            return res.status(StatusCode.ClientErrorConflict).send(DecisionAlreadyRSVPdError);
        }

        try {
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
        } catch (error) {
            // Release the claim so the applicant can try again
            await Models.AdmissionDecision.updateOne({ userId }, { response: DecisionResponse.PENDING });
            throw error;
        }

        const roles = updatedDecision.admittedPro ? [Role.PRO, Role.ATTENDEE] : [Role.ATTENDEE];
        await Models.AuthInfo.updateOne({ userId }, { $addToSet: { roles: { $each: roles } } });

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

        // Claim the RSVP atomically so concurrent requests can't both act on it
        const updatedDecision = await Models.AdmissionDecision.findOneAndUpdate(
            { userId, status: DecisionStatus.ACCEPTED, response: DecisionResponse.PENDING },
            { response: DecisionResponse.DECLINED },
            { new: true },
        );
        if (!updatedDecision) {
            return res.status(StatusCode.ClientErrorConflict).send(DecisionAlreadyRSVPdError);
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
    "/applicants/",
    specification({
        method: "get",
        path: "/admission/applicants/",
        tag: Tag.ADMISSION,
        role: Role.STAFF,
        summary: "Lists every submitted application with its reviewers, scores and admission tag",
        description:
            "Tags: IN_REVIEW (no decision or TBD), ADMITTED (accepted, no reimbursement), " +
            "ADMITTED_REIMBURSED (accepted with a reimbursement), WAITLISTED, REJECTED. " +
            'Use reviewerId=none to find applications with no reviewers. "edited" is true when a reviewer changed the AI score.',
        query: ApplicantsQuerySchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The matching applicants",
                schema: ApplicantsSchema,
            },
        },
    }),
    async (req, res) => {
        const { tag, reviewerId } = req.query;
        const applicants = await listApplicants({ tag, reviewerId });
        return res.status(StatusCode.SuccessOK).send(applicants);
    },
);

admissionRouter.get(
    "/applicants/emails/",
    specification({
        method: "get",
        path: "/admission/applicants/emails/",
        tag: Tag.ADMISSION,
        role: Role.STAFF,
        summary: "Lists the emails of every applicant with an admission tag, for building a mailing list",
        query: ApplicantsEmailsQuerySchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The emails",
                schema: ApplicantEmailsSchema,
            },
        },
    }),
    async (req, res) => {
        const applicants = await listApplicants({ tag: req.query.tag });
        return res.status(StatusCode.SuccessOK).send({ emails: applicants.map((applicant) => applicant.email) });
    },
);

admissionRouter.put(
    "/applicants/:id/tag/",
    specification({
        method: "put",
        path: "/admission/applicants/{id}/tag/",
        tag: Tag.ADMISSION,
        role: Role.STAFF,
        summary: "Sets the admission tag of the specified applicant without sending an email",
        description:
            "Creates or updates the applicant's admission decision to match the tag. " +
            "ADMITTED_REIMBURSED needs a reimbursementValue greater than 0, other tags ignore it. " +
            "If the status or reimbursement changes, emailSent is reset to false. No email is sent.",
        parameters: z.object({
            id: UserIdSchema,
        }),
        body: ApplicantTagUpdateRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The applicant's tag and decision",
                schema: ApplicantTagUpdateResponseSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Couldn't find the application",
                schema: RegistrationNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = req.params;
        const { tag, reimbursementValue } = req.body;

        if (!(await Models.RegistrationApplicationSubmitted.exists({ userId }))) {
            return res.status(StatusCode.ClientErrorNotFound).send(RegistrationNotFoundError);
        }

        const fields = getDecisionFieldsForTag(tag, reimbursementValue);
        const existing = await Models.AdmissionDecision.findOne({ userId }).select("status reimbursementValue").lean();
        const changed = existing?.status !== fields.status || existing.reimbursementValue !== fields.reimbursementValue;

        // Upsert keeps admittedPro, response and the other fields of an existing decision
        const decision = await Models.AdmissionDecision.findOneAndUpdate(
            { userId },
            { $set: changed ? { ...fields, emailSent: false } : fields },
            { upsert: true, new: true, lean: true },
        );
        if (!decision) {
            throw new Error("Failed to save the admission decision");
        }

        return res.status(StatusCode.SuccessOK).send({
            userId: decision.userId,
            status: decision.status,
            admittedPro: decision.admittedPro,
            response: decision.response,
            emailSent: decision.emailSent,
            reimbursementValue: decision.reimbursementValue,
            correctProChallenge: decision.correctProChallenge,
            proChallengeScore: decision.proChallengeScore,
            tag: getApplicantTag(decision),
        });
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
        const MIN_REVIEW_SCORE = 1;
        const MAX_REVIEW_SCORE = 5;
        const summaries = await Models.RegistrationApplicationSubmitted.aggregate<ApplicationReviewSummary>([
            {
                $project: {
                    _id: 0,
                    userId: 1,
                    scores: {
                        $filter: {
                            input: { $ifNull: ["$reviews.score", []] },
                            cond: {
                                $and: [
                                    {
                                        $cond: [{ $isNumber: "$$this" }, { $eq: [{ $mod: ["$$this", 1] }, 0] }, false],
                                    },
                                    { $gte: ["$$this", MIN_REVIEW_SCORE] },
                                    { $lte: ["$$this", MAX_REVIEW_SCORE] },
                                ],
                            },
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

        const assigned = await getNextReviewApplication(reviewerId);
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
        summary: "Submits the currently authenticated staff member's review for the specified user's application",
        description:
            "Submitting again for the same application replaces your previous review, " +
            "so leaving out the comment removes any comment you previously made.",
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
        const comment = req.body.comment || undefined;

        // The newest score from any reviewer becomes the final score
        const finalScore = { finalScore: score, finalScoreSetBy: reviewerId, finalScoreSetAt: Date.now() };

        // The request replaces the whole review, so no comment means remove the old one
        const replaceReview = comment
            ? { $set: { "reviews.$.score": score, "reviews.$.comment": comment, ...finalScore } }
            : { $set: { "reviews.$.score": score, ...finalScore }, $unset: { "reviews.$.comment": "" } };

        // Update their existing review (assigned or already scored)
        const updated = await Models.RegistrationApplicationSubmitted.updateOne(
            { userId, "reviews.reviewerId": reviewerId },
            replaceReview,
        );
        if (updated.matchedCount > 0) {
            return res.status(StatusCode.SuccessOK).send({ success: true });
        }

        // Otherwise add a new review, guarded so a concurrent request can't add a second one
        const added = await Models.RegistrationApplicationSubmitted.updateOne(
            { userId, "reviews.reviewerId": { $ne: reviewerId } },
            { $push: { reviews: { reviewerId, score, comment } }, $inc: { reviewCount: 1 }, $set: finalScore },
        );
        if (added.matchedCount > 0) {
            return res.status(StatusCode.SuccessOK).send({ success: true });
        }

        // Neither matched: either there is no application, or a concurrent request just added the review
        const exists = await Models.RegistrationApplicationSubmitted.exists({ userId });
        if (!exists) {
            return res.status(StatusCode.ClientErrorNotFound).send(RegistrationNotFoundError);
        }
        await Models.RegistrationApplicationSubmitted.updateOne({ userId, "reviews.reviewerId": reviewerId }, replaceReview);
        return res.status(StatusCode.SuccessOK).send({ success: true });
    },
);

admissionRouter.get(
    "/review/:id/",
    specification({
        method: "get",
        path: "/admission/review/{id}/",
        tag: Tag.ADMISSION,
        role: Role.STAFF,
        summary: "Gets every staff member's review, the AI score and the final score of the specified user's application",
        description:
            "Only scored reviews are returned - reviewers who were assigned but haven't scored yet are excluded. " +
            "The final score is the last score set by the AI or a reviewer.",
        parameters: z.object({
            id: UserIdSchema,
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The reviews and scores",
                schema: ApplicationReviewDetailsSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Couldn't find the application",
                schema: RegistrationNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const MIN_REVIEW_SCORE = 1;
        const MAX_REVIEW_SCORE = 5;
        const { id: userId } = req.params;

        const application = await Models.RegistrationApplicationSubmitted.findOne({ userId })
            .select("+reviews +aiScore +aiReasons +aiGradedAt +finalScore +finalScoreSetBy +finalScoreSetAt")
            .lean();
        if (!application) {
            return res.status(StatusCode.ClientErrorNotFound).send(RegistrationNotFoundError);
        }

        const reviews = (application.reviews ?? []).flatMap(({ reviewerId, score, comment }) => {
            const isScoredReview =
                typeof score === "number" && Number.isInteger(score) && score >= MIN_REVIEW_SCORE && score <= MAX_REVIEW_SCORE;
            return isScoredReview ? [{ reviewerId, score, comment }] : [];
        });
        return res.status(StatusCode.SuccessOK).send({
            reviews,
            aiScore: application.aiScore ?? null,
            aiReasons: application.aiReasons ?? [],
            aiGradedAt: application.aiGradedAt ?? null,
            finalScore: application.finalScore ?? null,
            finalScoreSetBy: application.finalScoreSetBy ?? null,
            finalScoreSetAt: application.finalScoreSetAt ?? null,
        });
    },
);

admissionRouter.put(
    "/review/:id/reviewers/",
    specification({
        method: "put",
        path: "/admission/review/{id}/reviewers/",
        tag: Tag.ADMISSION,
        role: Role.STAFF,
        summary: "Assigns a reviewer to the specified user's application",
        description:
            "Adds a pending review (no score yet) for the reviewer. " +
            "Does nothing if the reviewer is already assigned or has already scored the application.",
        parameters: z.object({
            id: UserIdSchema,
        }),
        body: ApplicationReviewerRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The reviewer is assigned",
                schema: SuccessResponseSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Couldn't find the application",
                schema: RegistrationNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = req.params;
        const { reviewerId } = req.body;

        // Guarded so a reviewer can never be added twice, even with concurrent requests
        const added = await Models.RegistrationApplicationSubmitted.updateOne(
            { userId, "reviews.reviewerId": { $ne: reviewerId } },
            { $push: { reviews: { reviewerId, score: null } }, $inc: { reviewCount: 1 } },
        );
        if (added.matchedCount === 0 && !(await Models.RegistrationApplicationSubmitted.exists({ userId }))) {
            return res.status(StatusCode.ClientErrorNotFound).send(RegistrationNotFoundError);
        }

        return res.status(StatusCode.SuccessOK).send({ success: true });
    },
);

admissionRouter.delete(
    "/review/:id/reviewers/:reviewerId/",
    specification({
        method: "delete",
        path: "/admission/review/{id}/reviewers/{reviewerId}/",
        tag: Tag.ADMISSION,
        role: Role.STAFF,
        summary: "Removes a reviewer from the specified user's application",
        description:
            "Only removes a pending review. A reviewer who has already scored the application cannot be removed. " +
            "Does nothing if the reviewer is not assigned.",
        parameters: z.object({
            id: UserIdSchema,
            reviewerId: UserIdSchema,
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The reviewer is no longer assigned",
                schema: SuccessResponseSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Couldn't find the application",
                schema: RegistrationNotFoundErrorSchema,
            },
            [StatusCode.ClientErrorConflict]: {
                description: "The reviewer has already scored the application",
                schema: ReviewAlreadyScoredErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId, reviewerId } = req.params;

        const removed = await Models.RegistrationApplicationSubmitted.updateOne(
            { userId, reviews: { $elemMatch: { reviewerId, score: null } } },
            { $pull: { reviews: { reviewerId, score: null } }, $inc: { reviewCount: -1 } },
        );
        if (removed.matchedCount > 0) {
            // Stop the "next application" tracker from handing the same application back to this reviewer
            await Models.ApplicationReviewAssignment.deleteOne({ _id: reviewerId, userId });
            return res.status(StatusCode.SuccessOK).send({ success: true });
        }

        const application = await Models.RegistrationApplicationSubmitted.findOne({ userId }).select("+reviews").lean();
        if (!application) {
            return res.status(StatusCode.ClientErrorNotFound).send(RegistrationNotFoundError);
        }
        if ((application.reviews ?? []).some((review) => review.reviewerId === reviewerId)) {
            return res.status(StatusCode.ClientErrorConflict).send(ReviewAlreadyScoredError);
        }
        return res.status(StatusCode.SuccessOK).send({ success: true });
    },
);

export default admissionRouter;
