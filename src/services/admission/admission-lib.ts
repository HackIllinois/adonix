import { MongoServerError } from "mongodb";
import Models from "../../common/models";
import { RegistrationApplicationSubmitted } from "../registration/registration-schemas";

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
