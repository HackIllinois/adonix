import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import Models from "../../common/models";
import { DecisionStatus, DecisionResponse, AdmissionDecision } from "./admission-schemas";
import Config, { Templates } from "../../common/config";
import { RegistrationApplicationSubmitted } from "../registration/registration-schemas";
import { getAsStaff, getAsUser, putAsStaff, putAsUser, getAsAttendee, putAsApplicant, TESTER } from "../../common/testTools";
import { StatusCode } from "status-code-enum";
import type * as MailLib from "../../services/mail/mail-lib";
import { AttendeeProfileCreateRequest } from "../profile/profile-schemas";
import { AttendeeTeam } from "../attendee-team/attendee-team-schemas";
import { generateJwtToken } from "../../common/auth";
import { Provider, Role } from "../auth/auth-schemas";

const TESTER_DECISION = {
    userId: TESTER.id,
    status: DecisionStatus.ACCEPTED,
    response: DecisionResponse.PENDING,
    emailSent: false,
    admittedPro: false,
    reimbursementValue: 0,
    correctProChallenge: false,
} satisfies AdmissionDecision;

const OTHER_DECISION = {
    userId: "other-user",
    status: DecisionStatus.REJECTED,
    response: DecisionResponse.DECLINED,
    emailSent: true,
    admittedPro: false,
    reimbursementValue: 0,
    correctProChallenge: false,
} satisfies AdmissionDecision;

const TESTER_APPLICATION = {
    userId: TESTER.id,
    firstName: TESTER.name,
    lastName: TESTER.name,
    preferredName: "",
    age: "21",
    email: TESTER.email,
    phoneNumber: TESTER.phoneNumber,
    gender: "Other",
    race: ["Prefer Not to Answer"],
    country: "United States",
    state: "Illinois",
    school: "University of Illinois Urbana-Champaign",
    education: "Undergraduate University (3+ year)",
    graduate: "Spring 2026",
    major: "Computer Science",
    underrepresented: "No",
    hackathonsParticipated: "2-3",
    application1: "I love hack",
    application2: "I love hack",
    application3: "I love hack",
    applicationOptional: "optional essay",
    pro: true,
    attribution: ["Word of Mouth", "Instagram"],
    eventInterest: ["Meeting New People"],
    requestTravelReimbursement: false,
    mlhNewsletter: true,
} satisfies RegistrationApplicationSubmitted;

const CREATE_REQUEST = {
    avatarId: TESTER.avatarId,
    displayName: TESTER.name,
    discordTag: TESTER.discordTag,
    dietaryRestrictions: ["Peanut Allergy"],
    shirtSize: "M",
} satisfies AttendeeProfileCreateRequest;

const TEST_TEAM = {
    name: "TestTeam",
    badge: "https://test-badge.png",
    points: 0,
    members: 0,
} satisfies AttendeeTeam;

const updateRequest = [
    {
        userId: TESTER.id,
        status: DecisionStatus.ACCEPTED,
        response: DecisionResponse.PENDING,
        admittedPro: true,
        reimbursementValue: 12,
    },
];

beforeEach(async () => {
    await Models.AdmissionDecision.create(TESTER_DECISION);
    await Models.AdmissionDecision.create(OTHER_DECISION);
    await Models.RegistrationApplicationSubmitted.create(TESTER_APPLICATION);
    await Models.AttendeeTeam.create(TEST_TEAM);
});

describe("GET /admission/notsent/", () => {
    it("gives forbidden error for user without elevated perms", async () => {
        const responseUser = await getAsUser("/admission/notsent/").expect(StatusCode.ClientErrorForbidden);
        expect(JSON.parse(responseUser.text)).toHaveProperty("error", "Forbidden");
    });
    it("should return a list of applicants without email sent", async () => {
        const response = await getAsStaff("/admission/notsent/").expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject(expect.arrayContaining([expect.objectContaining(TESTER_DECISION)]));
    });
});

function mockSendMail(): jest.SpiedFunction<typeof MailLib.sendMail> {
    const mailLib = require("../../services/mail/mail-lib") as typeof MailLib;
    return jest.spyOn(mailLib, "sendMail");
}

function mockSendBulkMail(): jest.SpiedFunction<typeof MailLib.sendBulkMail> {
    const mailLib = require("../../services/mail/mail-lib") as typeof MailLib;
    return jest.spyOn(mailLib, "sendBulkMail");
}

describe("PUT /admission/update/", () => {
    let sendMail: jest.SpiedFunction<typeof MailLib.sendMail> = undefined!;
    let sendBulkMail: jest.SpiedFunction<typeof MailLib.sendBulkMail> = undefined!;

    beforeEach(async () => {
        // Mock successful send by default
        sendMail = mockSendMail();
        sendMail.mockImplementation(async () => "");

        sendBulkMail = mockSendBulkMail();
        sendBulkMail.mockImplementation(async () => ({ success: true, successCount: 0, failedCount: 0, errors: [] }));
    });

    it("gives forbidden error for user without elevated perms", async () => {
        const responseUser = await putAsUser("/admission/update/").send(updateRequest).expect(StatusCode.ClientErrorForbidden);
        expect(JSON.parse(responseUser.text)).toHaveProperty("error", "Forbidden");
    });

    it("should update application status of applicants", async () => {
        await Models.AdmissionDecision.findOneAndUpdate({ userId: TESTER_DECISION.userId }, { status: DecisionStatus.TBD });

        const response = await putAsStaff("/admission/update/").send(updateRequest).expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toEqual({ success: true });

        const ops = updateRequest.map((entry) => Models.AdmissionDecision.findOne({ userId: entry.userId }));
        const retrievedEntries = await Promise.all(ops);

        expect(sendBulkMail).toBeCalledWith(
            Templates.STATUS_UPDATE,
            [
                {
                    email: TESTER_APPLICATION.email,
                    data: { name: TESTER_APPLICATION.firstName, isAccepted: true, reimbursementValue: 12, pro: true },
                },
            ],
            { name: "", isAccepted: false, reimbursementValue: false, pro: false },
        );

        expect(retrievedEntries).toMatchObject(
            expect.arrayContaining(
                updateRequest.map((item) => expect.objectContaining({ status: item.status, userId: item.userId })),
            ),
        );
    });
});

describe("GET /admission/rsvp/", () => {
    it("gives a DecisionNotFound error for an non-existent user", async () => {
        await Models.AdmissionDecision.deleteOne({
            userId: TESTER.id,
        });

        const response = await getAsAttendee("/admission/rsvp/").expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "DecisionNotFound");
    });

    it("works for an attendee user and returns filtered data", async () => {
        const response = await getAsAttendee("/admission/rsvp/").expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({
            userId: TESTER_DECISION.userId,
            status: TESTER_DECISION.status,
            response: TESTER_DECISION.response,
        });
    });
});
describe("GET /admission/rsvp/staff/", () => {
    it("gives forbidden error for user without elevated perms", async () => {
        const responseUser = await getAsUser("/admission/rsvp/staff/")
            .send(updateRequest)
            .expect(StatusCode.ClientErrorForbidden);
        expect(JSON.parse(responseUser.text)).toHaveProperty("error", "Forbidden");
    });

    it("works for a staff user and returns unfiltered data", async () => {
        const response = await getAsStaff("/admission/rsvp/staff/").expect(StatusCode.SuccessOK);

        // expect(JSON.parse(response.text)).toMatchObject(TESTER_DECISION);
        expect(JSON.parse(response.text)).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    // Specify the properties of AdmissionDecision since its an array of custom model
                    userId: expect.any(String),
                    status: expect.any(String),
                    response: expect.any(String),
                    admittedPro: expect.any(Boolean),
                    emailSent: expect.any(Boolean),
                    reimbursementValue: expect.any(Number),
                }),
            ]),
        );
    });
});

describe("GET /admission/rsvp/:id", () => {
    it("returns forbidden error if caller doesn't have elevated perms", async () => {
        const response = await getAsAttendee(`/admission/rsvp/${TESTER.id}`).expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("gets if caller has elevated perms", async () => {
        const response = await getAsStaff(`/admission/rsvp/${TESTER.id}`).expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject(TESTER_DECISION);
    });

    it("returns DecisionNotFound error if user doesn't exist", async () => {
        const response = await getAsStaff("/admission/rsvp/idontexist").expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "DecisionNotFound");
    });
});

describe("PUT /admission/accept/", () => {
    let sendMail: jest.SpiedFunction<typeof MailLib.sendMail> = undefined!;

    beforeEach(async () => {
        // Mock successful send by default
        sendMail = mockSendMail();
        sendMail.mockImplementation(async () => "");
    });

    it("returns DecisionNotFound for nonexistent user", async () => {
        await Models.AdmissionDecision.deleteOne({
            userId: TESTER.id,
        });

        const response = await putAsApplicant("/admission/accept/").send(CREATE_REQUEST).expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "DecisionNotFound");
    });

    it("lets applicant accept accepted decision", async () => {
        await putAsApplicant("/admission/accept/").send(CREATE_REQUEST).expect(StatusCode.SuccessOK);
        const stored = await Models.AdmissionDecision.findOne({ userId: TESTER.id });

        expect(sendMail).toBeCalledWith(Templates.RSVP_ACCEPTED, TESTER_APPLICATION.email, {
            name: TESTER_APPLICATION.firstName,
        });

        expect(stored).toMatchObject({
            ...TESTER_DECISION,
            response: DecisionResponse.ACCEPTED,
        } satisfies AdmissionDecision);

        const profile = await Models.AttendeeProfile.findOne({ userId: TESTER.id });
        expect(profile).toMatchObject({
            userId: TESTER.id,
            team: TEST_TEAM.name,
            teamBadge: TEST_TEAM.badge,
        });

        const team = await Models.AttendeeTeam.findOne({ name: TEST_TEAM.name });
        expect(team!.members).toBe(1);
    });

    it("doesn't let applicant accept rejected decision", async () => {
        await Models.AdmissionDecision.findOneAndUpdate({ userId: TESTER.id }, { status: DecisionStatus.REJECTED });

        const response = await putAsApplicant("/admission/accept/").send(CREATE_REQUEST).expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NotAccepted");
    });
    it("does not let applicant re-rsvp twice", async () => {
        await Models.AdmissionDecision.findOneAndUpdate(
            { userId: TESTER.id },
            { status: DecisionStatus.ACCEPTED, response: DecisionResponse.DECLINED },
        );

        const response = await putAsApplicant("/admission/accept/").send(CREATE_REQUEST).expect(StatusCode.ClientErrorConflict);
        expect(JSON.parse(response.text)).toHaveProperty("error", "AlreadyRSVPed");
    });

    it("only accepts once when two requests race", async () => {
        const responses = await Promise.all([
            putAsApplicant("/admission/accept/").send(CREATE_REQUEST),
            putAsApplicant("/admission/accept/").send(CREATE_REQUEST),
        ]);

        expect(responses.map((response) => response.status).sort()).toEqual([
            StatusCode.SuccessOK,
            StatusCode.ClientErrorConflict,
        ]);
        expect(await Models.AttendeeProfile.countDocuments({ userId: TESTER.id })).toBe(1);
        expect((await Models.AttendeeTeam.findOne({ name: TEST_TEAM.name }))!.members).toBe(1);
    });

    it("does not decline after a racing accept", async () => {
        const responses = await Promise.all([
            putAsApplicant("/admission/accept/").send(CREATE_REQUEST),
            putAsApplicant("/admission/decline/"),
        ]);

        expect(responses.filter((response) => response.status === StatusCode.SuccessOK)).toHaveLength(1);
        const stored = await Models.AdmissionDecision.findOne({ userId: TESTER.id });
        const profileCount = await Models.AttendeeProfile.countDocuments({ userId: TESTER.id });
        expect(profileCount).toBe(stored!.response === DecisionResponse.ACCEPTED ? 1 : 0);
    });

    it("does not let applicant accept with empty or incomplete profile data", async () => {
        await putAsApplicant("/admission/accept/").expect(StatusCode.ClientErrorBadRequest);
        await putAsApplicant("/admission/accept/").send({ displayName: "Bob" }).expect(StatusCode.ClientErrorBadRequest);
    });
});

describe("PUT /admission/decline/", () => {
    let sendMail: jest.SpiedFunction<typeof MailLib.sendMail> = undefined!;

    beforeEach(async () => {
        // Mock successful send by default
        sendMail = mockSendMail();
        sendMail.mockImplementation(async () => "");
    });

    it("returns DecisionNotFound for nonexistent user", async () => {
        await Models.AdmissionDecision.deleteOne({
            userId: TESTER.id,
        });

        const response = await putAsApplicant("/admission/decline/").expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "DecisionNotFound");
    });

    it("lets applicant decline accepted decision", async () => {
        await putAsApplicant("/admission/decline/").expect(StatusCode.SuccessOK);
        const stored = await Models.AdmissionDecision.findOne({ userId: TESTER.id });

        expect(sendMail).toBeCalledWith(Templates.RSVP_DECLINED, TESTER_APPLICATION.email);

        expect(stored).toMatchObject({
            ...TESTER_DECISION,
            response: DecisionResponse.DECLINED,
        } satisfies AdmissionDecision);
    });

    it("doesn't let applicant accept rejected decision", async () => {
        await Models.AdmissionDecision.findOneAndUpdate({ userId: TESTER.id }, { status: DecisionStatus.REJECTED });

        const response = await putAsApplicant("/admission/decline/").expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NotAccepted");
    });

    it("does not let applicant re-rsvp twice", async () => {
        await Models.AdmissionDecision.findOneAndUpdate(
            { userId: TESTER.id },
            { status: DecisionStatus.ACCEPTED, response: DecisionResponse.DECLINED },
        );

        const response = await putAsApplicant("/admission/decline/").expect(StatusCode.ClientErrorConflict);
        expect(JSON.parse(response.text)).toHaveProperty("error", "AlreadyRSVPed");
    });
});

// An application that other staff have already reviewed twice
const REVIEWED_APPLICATION = {
    ...TESTER_APPLICATION,
    userId: "reviewed-applicant",
    reviews: [
        { reviewerId: "other-staff-1", score: 3 },
        { reviewerId: "other-staff-2", score: 4 },
    ],
    reviewCount: 2,
} satisfies RegistrationApplicationSubmitted;

async function getReviews(userId: string): Promise<Pick<RegistrationApplicationSubmitted, "reviews" | "reviewCount">> {
    const application = await Models.RegistrationApplicationSubmitted.findOne({ userId }).select("+reviews +reviewCount").lean();
    return { reviews: application?.reviews, reviewCount: application?.reviewCount };
}

describe("GET /admission/review/next/", () => {
    beforeEach(async () => {
        await Models.RegistrationApplicationSubmitted.create(REVIEWED_APPLICATION);
    });

    it("gives forbidden error for user without elevated perms", async () => {
        const response = await getAsUser("/admission/review/next/").expect(StatusCode.ClientErrorForbidden);
        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("assigns the least reviewed application", async () => {
        const response = await getAsStaff("/admission/review/next/").expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject(TESTER_APPLICATION);

        expect(await getReviews(TESTER.id)).toMatchObject({
            reviews: [{ reviewerId: TESTER.id, score: null }],
            reviewCount: 1,
        });
        expect(await getReviews(REVIEWED_APPLICATION.userId)).toMatchObject({ reviewCount: 2 });
    });

    it("does not include reviews in the response", async () => {
        await Models.RegistrationApplicationSubmitted.deleteOne({ userId: TESTER.id });

        const response = await getAsStaff("/admission/review/next/").expect(StatusCode.SuccessOK);
        const body = JSON.parse(response.text);
        expect(body).toHaveProperty("userId", REVIEWED_APPLICATION.userId);
        expect(body).not.toHaveProperty("reviews");
        expect(body).not.toHaveProperty("reviewCount");
    });

    it("returns the same application until it is scored", async () => {
        const first = await getAsStaff("/admission/review/next/").expect(StatusCode.SuccessOK);
        const second = await getAsStaff("/admission/review/next/").expect(StatusCode.SuccessOK);

        expect(JSON.parse(second.text)).toHaveProperty("userId", JSON.parse(first.text).userId);
        expect(await getReviews(TESTER.id)).toMatchObject({ reviewCount: 1 });
        expect(await getReviews(REVIEWED_APPLICATION.userId)).toMatchObject({ reviewCount: 2 });
    });

    it.each([1, 2])("keeps one pending application when next requests race with %i available", async (available) => {
        if (available === 1) {
            await Models.RegistrationApplicationSubmitted.deleteOne({ userId: REVIEWED_APPLICATION.userId });
        }
        const responses = await Promise.all(Array.from({ length: 8 }, () => getAsStaff("/admission/review/next/")));

        expect(responses.map((response) => response.status)).toEqual(Array(8).fill(StatusCode.SuccessOK));
        expect(new Set(responses.map((response) => JSON.parse(response.text).userId)).size).toBe(1);
        expect(
            await Models.RegistrationApplicationSubmitted.countDocuments({
                reviews: { $elemMatch: { reviewerId: TESTER.id, score: null } },
            }),
        ).toBe(1);
        expect(await getReviews(TESTER.id)).toMatchObject({ reviewCount: 1 });
        if (available === 2) {
            expect(await getReviews(REVIEWED_APPLICATION.userId)).toMatchObject({ reviewCount: 2 });
        }
    });

    it("resumes a pending review created before assignment tracking", async () => {
        await Models.RegistrationApplicationSubmitted.updateOne(
            { userId: REVIEWED_APPLICATION.userId },
            { $push: { reviews: { reviewerId: TESTER.id, score: null } }, $inc: { reviewCount: 1 } },
        );

        const response = await getAsStaff("/admission/review/next/").expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toHaveProperty("userId", REVIEWED_APPLICATION.userId);
        expect(await getReviews(REVIEWED_APPLICATION.userId)).toMatchObject({ reviewCount: 3 });
    });

    it("moves on when the assigned application is deleted", async () => {
        const first = await getAsStaff("/admission/review/next/").expect(StatusCode.SuccessOK);
        await Models.RegistrationApplicationSubmitted.deleteOne({ userId: JSON.parse(first.text).userId });

        const second = await getAsStaff("/admission/review/next/").expect(StatusCode.SuccessOK);
        expect(JSON.parse(second.text)).toHaveProperty("userId", REVIEWED_APPLICATION.userId);
    });

    it("finishes an assignment claimed before the pending review was saved", async () => {
        await Models.ApplicationReviewAssignment.create({
            _id: TESTER.id,
            userId: REVIEWED_APPLICATION.userId,
            reviewCount: REVIEWED_APPLICATION.reviewCount,
        });

        const response = await getAsStaff("/admission/review/next/").expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toHaveProperty("userId", REVIEWED_APPLICATION.userId);
        expect(await getReviews(REVIEWED_APPLICATION.userId)).toMatchObject({
            reviews: [...REVIEWED_APPLICATION.reviews, { reviewerId: TESTER.id, score: null }],
            reviewCount: 3,
        });
    });

    it("spreads simultaneous reviewers across equally reviewed applications", async () => {
        await Models.RegistrationApplicationSubmitted.updateOne(
            { userId: REVIEWED_APPLICATION.userId },
            { reviews: [], reviewCount: 0 },
        );
        const otherStaffToken = generateJwtToken({
            id: "another-reviewer",
            email: "another-reviewer@hackillinois.org",
            provider: Provider.GOOGLE,
            roles: [Role.USER, Role.STAFF],
        });

        const responses = await Promise.all([
            getAsStaff("/admission/review/next/"),
            getAsStaff("/admission/review/next/").set("Authorization", otherStaffToken),
        ]);

        expect(responses.map((response) => response.status)).toEqual([StatusCode.SuccessOK, StatusCode.SuccessOK]);
        expect(new Set(responses.map((response) => JSON.parse(response.text).userId)).size).toBe(2);
        expect(await getReviews(TESTER.id)).toMatchObject({ reviewCount: 1 });
        expect(await getReviews(REVIEWED_APPLICATION.userId)).toMatchObject({ reviewCount: 1 });
    });

    it("assigns applications submitted before the review counter existed", async () => {
        await Models.RegistrationApplicationSubmitted.collection.updateOne(
            { userId: TESTER.id },
            { $unset: { reviews: "", reviewCount: "" } },
        );

        const response = await getAsStaff("/admission/review/next/").expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toHaveProperty("userId", TESTER.id);
        expect(await getReviews(TESTER.id)).toMatchObject({
            reviews: [{ reviewerId: TESTER.id, score: null }],
            reviewCount: 1,
        });
    });

    it("skips applications the reviewer has already scored", async () => {
        await Models.RegistrationApplicationSubmitted.updateOne(
            { userId: TESTER.id },
            { reviews: [{ reviewerId: TESTER.id, score: 5 }], reviewCount: 1 },
        );

        const response = await getAsStaff("/admission/review/next/").expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toHaveProperty("userId", REVIEWED_APPLICATION.userId);
        expect(await getReviews(REVIEWED_APPLICATION.userId)).toMatchObject({ reviewCount: 3 });
    });

    it("moves on to the next application after scoring", async () => {
        const first = await getAsStaff("/admission/review/next/").expect(StatusCode.SuccessOK);
        await putAsStaff(`/admission/review/${JSON.parse(first.text).userId}/`)
            .send({ score: 2 })
            .expect(StatusCode.SuccessOK);

        const second = await getAsStaff("/admission/review/next/").expect(StatusCode.SuccessOK);
        expect(JSON.parse(second.text)).toHaveProperty("userId", REVIEWED_APPLICATION.userId);
    });

    it("gives not found when the reviewer has scored every application", async () => {
        await Models.RegistrationApplicationSubmitted.updateMany(
            {},
            { $push: { reviews: { reviewerId: TESTER.id, score: 5 } }, $inc: { reviewCount: 1 } },
        );

        const response = await getAsStaff("/admission/review/next/").expect(StatusCode.ClientErrorNotFound);
        expect(JSON.parse(response.text)).toHaveProperty("error", "NoApplicationsToReview");
    });
});

describe("PUT /admission/review/:id/", () => {
    beforeEach(async () => {
        await Models.RegistrationApplicationSubmitted.create(REVIEWED_APPLICATION);
    });

    it("gives forbidden error for user without elevated perms", async () => {
        const response = await putAsUser(`/admission/review/${TESTER.id}/`)
            .send({ score: 3 })
            .expect(StatusCode.ClientErrorForbidden);
        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("scores an assigned application", async () => {
        await getAsStaff("/admission/review/next/").expect(StatusCode.SuccessOK);

        await putAsStaff(`/admission/review/${TESTER.id}/`).send({ score: 4 }).expect(StatusCode.SuccessOK);

        expect(await getReviews(TESTER.id)).toMatchObject({
            reviews: [{ reviewerId: TESTER.id, score: 4 }],
            reviewCount: 1,
        });
    });

    it("adds a review to an application that was not assigned", async () => {
        await putAsStaff(`/admission/review/${REVIEWED_APPLICATION.userId}/`).send({ score: 5 }).expect(StatusCode.SuccessOK);

        expect(await getReviews(REVIEWED_APPLICATION.userId)).toMatchObject({
            reviews: [...REVIEWED_APPLICATION.reviews, { reviewerId: TESTER.id, score: 5 }],
            reviewCount: 3,
        });
    });

    it("replaces the score instead of adding another review when submitted again", async () => {
        await putAsStaff(`/admission/review/${REVIEWED_APPLICATION.userId}/`).send({ score: 5 }).expect(StatusCode.SuccessOK);
        await putAsStaff(`/admission/review/${REVIEWED_APPLICATION.userId}/`).send({ score: 1 }).expect(StatusCode.SuccessOK);

        const { reviews, reviewCount } = await getReviews(REVIEWED_APPLICATION.userId);
        expect(reviews).toHaveLength(3);
        expect(reviewCount).toBe(3);
        expect(reviews).toMatchObject([...REVIEWED_APPLICATION.reviews, { reviewerId: TESTER.id, score: 1 }]);
    });

    it.each([0, 6, 2.5, "3"])("rejects an invalid score of %p", async (score) => {
        const response = await putAsStaff(`/admission/review/${TESTER.id}/`)
            .send({ score })
            .expect(StatusCode.ClientErrorBadRequest);
        expect(JSON.parse(response.text)).toHaveProperty("error", "BadRequest");
        expect(await getReviews(TESTER.id)).toMatchObject({ reviews: [], reviewCount: 0 });
    });

    it("gives not found for an application that does not exist", async () => {
        const response = await putAsStaff("/admission/review/nonexistent-user/")
            .send({ score: 3 })
            .expect(StatusCode.ClientErrorNotFound);
        expect(JSON.parse(response.text)).toHaveProperty("error", "NotFound");
    });

    it("stores an optional comment with the review", async () => {
        await putAsStaff(`/admission/review/${TESTER.id}/`)
            .send({ score: 4, comment: "Great essays" })
            .expect(StatusCode.SuccessOK);

        const { reviews } = await getReviews(TESTER.id);
        expect(reviews).toEqual([{ reviewerId: TESTER.id, score: 4, comment: "Great essays" }]);
    });

    it("stores no comment when none is given", async () => {
        await putAsStaff(`/admission/review/${TESTER.id}/`).send({ score: 4 }).expect(StatusCode.SuccessOK);

        const { reviews } = await getReviews(TESTER.id);
        expect(reviews).toEqual([{ reviewerId: TESTER.id, score: 4 }]);
    });

    it("stores a comment on an assigned application", async () => {
        await getAsStaff("/admission/review/next/").expect(StatusCode.SuccessOK);
        await putAsStaff(`/admission/review/${TESTER.id}/`).send({ score: 2, comment: "Too short" }).expect(StatusCode.SuccessOK);

        expect(await getReviews(TESTER.id)).toEqual({
            reviews: [{ reviewerId: TESTER.id, score: 2, comment: "Too short" }],
            reviewCount: 1,
        });
    });

    it("replaces the comment when submitted again", async () => {
        await putAsStaff(`/admission/review/${TESTER.id}/`).send({ score: 4, comment: "First" }).expect(StatusCode.SuccessOK);
        await putAsStaff(`/admission/review/${TESTER.id}/`).send({ score: 5, comment: "Second" }).expect(StatusCode.SuccessOK);

        expect(await getReviews(TESTER.id)).toEqual({
            reviews: [{ reviewerId: TESTER.id, score: 5, comment: "Second" }],
            reviewCount: 1,
        });
    });

    it("removes the comment when submitted again without one", async () => {
        await putAsStaff(`/admission/review/${TESTER.id}/`).send({ score: 4, comment: "First" }).expect(StatusCode.SuccessOK);
        await putAsStaff(`/admission/review/${TESTER.id}/`).send({ score: 4 }).expect(StatusCode.SuccessOK);

        expect(await getReviews(TESTER.id)).toEqual({
            reviews: [{ reviewerId: TESTER.id, score: 4 }],
            reviewCount: 1,
        });
    });

    it("rejects a comment that is too long", async () => {
        const response = await putAsStaff(`/admission/review/${TESTER.id}/`)
            .send({ score: 4, comment: "a".repeat(Config.MAX_ESSAY_LENGTH + 1) })
            .expect(StatusCode.ClientErrorBadRequest);
        expect(JSON.parse(response.text)).toHaveProperty("error", "BadRequest");
    });
});

describe("GET /admission/review/:id/", () => {
    it("gives forbidden error for user without elevated perms", async () => {
        const response = await getAsUser(`/admission/review/${TESTER.id}/`).expect(StatusCode.ClientErrorForbidden);
        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("returns scored reviews with their comments and leaves out pending ones", async () => {
        await Models.RegistrationApplicationSubmitted.create({
            ...REVIEWED_APPLICATION,
            reviews: [
                { reviewerId: "other-staff-1", score: 3, comment: "Decent" },
                { reviewerId: "other-staff-2", score: 4 },
                { reviewerId: "other-staff-3", score: null },
            ],
            reviewCount: 3,
        });

        const response = await getAsStaff(`/admission/review/${REVIEWED_APPLICATION.userId}/`).expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toEqual([
            { reviewerId: "other-staff-1", score: 3, comment: "Decent" },
            { reviewerId: "other-staff-2", score: 4 },
        ]);
    });

    it("ignores malformed review scores", async () => {
        await Models.RegistrationApplicationSubmitted.collection.insertOne({
            ...REVIEWED_APPLICATION,
            reviews: [
                { reviewerId: "other-staff-1", score: 3, comment: "Decent" },
                { reviewerId: "other-staff-2", score: 0 },
                { reviewerId: "other-staff-3", score: 6 },
                { reviewerId: "other-staff-4", score: "4" },
                { reviewerId: "other-staff-5", score: 2.5 },
            ],
            reviewCount: 5,
        });

        const response = await getAsStaff(`/admission/review/${REVIEWED_APPLICATION.userId}/`).expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toEqual([{ reviewerId: "other-staff-1", score: 3, comment: "Decent" }]);
    });

    it("returns an empty list for an application with no reviews", async () => {
        const response = await getAsStaff(`/admission/review/${TESTER.id}/`).expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toEqual([]);
    });

    it("gives not found for an application that does not exist", async () => {
        const response = await getAsStaff("/admission/review/nonexistent-user/").expect(StatusCode.ClientErrorNotFound);
        expect(JSON.parse(response.text)).toHaveProperty("error", "NotFound");
    });
});

describe("GET /admission/review/", () => {
    it("gives forbidden error for user without elevated perms", async () => {
        const response = await getAsUser("/admission/review/").expect(StatusCode.ClientErrorForbidden);
        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("returns the count and average of scored reviews for each application", async () => {
        await Models.RegistrationApplicationSubmitted.create({
            ...REVIEWED_APPLICATION,
            reviews: [...REVIEWED_APPLICATION.reviews, { reviewerId: "other-staff-3", score: null }],
            reviewCount: 3,
        });

        const response = await getAsStaff("/admission/review/").expect(StatusCode.SuccessOK);
        const summaries = JSON.parse(response.text);

        expect(summaries).toHaveLength(2);
        expect(summaries).toEqual(
            expect.arrayContaining([
                { userId: REVIEWED_APPLICATION.userId, reviewCount: 2, averageScore: 3.5 },
                { userId: TESTER.id, reviewCount: 0, averageScore: null },
            ]),
        );
    });

    it("ignores malformed review scores in summary calculations", async () => {
        await Models.RegistrationApplicationSubmitted.collection.insertOne({
            ...REVIEWED_APPLICATION,
            reviews: [
                { reviewerId: "other-staff-1", score: 3 },
                { reviewerId: "other-staff-2", score: 0 },
                { reviewerId: "other-staff-3", score: 6 },
                { reviewerId: "other-staff-4", score: "4" },
                { reviewerId: "other-staff-5", score: 2.5 },
            ],
            reviewCount: 5,
        });

        const response = await getAsStaff("/admission/review/").expect(StatusCode.SuccessOK);
        const summaries = JSON.parse(response.text);
        expect(summaries).toEqual(
            expect.arrayContaining([
                { userId: REVIEWED_APPLICATION.userId, reviewCount: 1, averageScore: 3 },
                { userId: TESTER.id, reviewCount: 0, averageScore: null },
            ]),
        );
    });
});
