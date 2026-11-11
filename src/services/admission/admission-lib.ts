import { MongoServerError } from "mongodb";
import Models from "../../common/models";
import { RegistrationApplicationSubmitted } from "../registration/registration-schemas";
import { Applicant, ApplicantTag, DecisionStatus, NO_REVIEWERS_FILTER } from "./admission-schemas";

const DUPLICATE_KEY_ERROR_CODE = 11000;

export async function getNextReviewApplication(reviewerId: string): Promise<RegistrationApplicationSubmitted | null> {
    const pendingReview = { reviews: { $elemMatch: { reviewerId, score: null } } };

    for (;;) {
        const pending = await Models.RegistrationApplicationSubmitted.findOne(pendingReview).lean();
        if (pending) {
            return pending;
        }

        let assignment = await Models.ApplicationReviewAssignment.findById(reviewerId).lean();
        if (!assignment) {
            const candidate = await Models.RegistrationApplicationSubmitted.findOne({
                "reviews.reviewerId": { $ne: reviewerId },
            })
                .sort({ reviewCount: 1 })
                .select("userId +reviewCount")
                .lean();
            if (!candidate) {
                // Another request may have assigned the last available application after our first read.
                return Models.RegistrationApplicationSubmitted.findOne(pendingReview).lean();
            }

            try {
                // Concurrent requests must agree on one application before adding a pending review.
                assignment = await Models.ApplicationReviewAssignment.findOneAndUpdate(
                    { _id: reviewerId },
                    { $setOnInsert: { userId: candidate.userId, reviewCount: candidate.reviewCount ?? 0 } },
                    { upsert: true, new: true },
                ).lean();
            } catch (error) {
                if (error instanceof MongoServerError && error.code === DUPLICATE_KEY_ERROR_CODE) {
                    continue;
                }
                throw error;
            }
        }

        if (!assignment) {
            throw new Error("Failed to claim a review assignment");
        }

        // Retry selection if another reviewer changed the count, preserving least-reviewed ordering.
        const countFilter =
            assignment.reviewCount === 0
                ? { $or: [{ reviewCount: 0 }, { reviewCount: { $exists: false } }] }
                : { reviewCount: assignment.reviewCount };
        // The conditional update makes retries safe, including after a server restart.
        const assigned = await Models.RegistrationApplicationSubmitted.findOneAndUpdate(
            { userId: assignment.userId, "reviews.reviewerId": { $ne: reviewerId }, ...countFilter },
            { $push: { reviews: { reviewerId, score: null } }, $inc: { reviewCount: 1 } },
            { new: true, lean: true },
        );
        if (assigned) {
            return assigned;
        }

        const alreadyAssigned = await Models.RegistrationApplicationSubmitted.findOne({
            userId: assignment.userId,
            ...pendingReview,
        }).lean();
        if (alreadyAssigned) {
            return alreadyAssigned;
        }

        // Scored, deleted, or reprioritized applications release the slot without disturbing a newer claim.
        await Models.ApplicationReviewAssignment.deleteOne({
            _id: reviewerId,
            userId: assignment.userId,
            reviewCount: assignment.reviewCount,
        });
    }
}

export function getApplicantTag(decision: { status: DecisionStatus; reimbursementValue: number } | undefined): ApplicantTag {
    switch (decision?.status) {
        case DecisionStatus.ACCEPTED:
            return decision.reimbursementValue > 0 ? ApplicantTag.ADMITTED_REIMBURSED : ApplicantTag.ADMITTED;
        case DecisionStatus.WAITLISTED:
            return ApplicantTag.WAITLISTED;
        case DecisionStatus.REJECTED:
            return ApplicantTag.REJECTED;
        default:
            // No decision yet, or TBD
            return ApplicantTag.IN_REVIEW;
    }
}

/** Decision fields that each tag stands for. Only ADMITTED_REIMBURSED keeps a reimbursement value. */
export function getDecisionFieldsForTag(
    tag: ApplicantTag,
    reimbursementValue = 0,
): { status: DecisionStatus; reimbursementValue: number } {
    const statusByTag: Record<ApplicantTag, DecisionStatus> = {
        [ApplicantTag.IN_REVIEW]: DecisionStatus.TBD,
        [ApplicantTag.ADMITTED]: DecisionStatus.ACCEPTED,
        [ApplicantTag.ADMITTED_REIMBURSED]: DecisionStatus.ACCEPTED,
        [ApplicantTag.WAITLISTED]: DecisionStatus.WAITLISTED,
        [ApplicantTag.REJECTED]: DecisionStatus.REJECTED,
    };
    return {
        status: statusByTag[tag],
        reimbursementValue: tag === ApplicantTag.ADMITTED_REIMBURSED ? reimbursementValue : 0,
    };
}

/** Lists every submitted application with its reviewers, scores and tag, keeping only rows that match the filters. */
export async function listApplicants(filters: { tag?: ApplicantTag; reviewerId?: string }): Promise<Applicant[]> {
    const [applications, decisions] = await Promise.all([
        Models.RegistrationApplicationSubmitted.find()
            .select("userId firstName lastName email school +reviews +aiScore +finalScore +finalScoreSetBy +aiGradeFailedAt")
            .lean(),
        Models.AdmissionDecision.find().select("userId status reimbursementValue").lean(),
    ]);
    const decisionByUser = new Map(decisions.map((decision) => [decision.userId, decision]));

    // One query for the names of all reviewers in the list
    const reviewerIds = [
        ...new Set(applications.flatMap((application) => (application.reviews ?? []).map((review) => review.reviewerId))),
    ];
    const reviewerInfos = await Models.UserInfo.find({ userId: { $in: reviewerIds } })
        .select("userId name")
        .lean();
    const reviewerNames = new Map(reviewerInfos.map((info) => [info.userId, info.name]));

    const applicants = applications.map((application): Applicant => {
        const aiScore = application.aiScore ?? null;
        const finalScore = application.finalScore ?? null;
        return {
            userId: application.userId,
            name: `${application.firstName} ${application.lastName}`,
            email: application.email,
            school: application.school,
            reviewers: (application.reviews ?? []).map(({ reviewerId, score }) => ({
                reviewerId,
                name: reviewerNames.get(reviewerId) ?? null,
                score: score ?? null,
            })),
            aiScore,
            finalScore,
            // A reviewer changed the score the AI gave
            edited: aiScore !== null && finalScore !== null && application.finalScoreSetBy !== "ai" && finalScore !== aiScore,
            aiGradeFailed: aiScore === null && (application.aiGradeFailedAt ?? null) !== null,
            tag: getApplicantTag(decisionByUser.get(application.userId)),
        };
    });

    return applicants.filter((applicant) => {
        if (filters.tag && applicant.tag !== filters.tag) {
            return false;
        }
        if (filters.reviewerId === NO_REVIEWERS_FILTER) {
            return applicant.reviewers.length === 0;
        }
        return !filters.reviewerId || applicant.reviewers.some((reviewer) => reviewer.reviewerId === filters.reviewerId);
    });
}
