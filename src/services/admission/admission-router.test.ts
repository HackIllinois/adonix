import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import Models from "../../common/models";
import { DecisionStatus, DecisionResponse, AdmissionDecision } from "./admission-schemas";
import Config, { Templates } from "../../common/config";
import { RegistrationApplicationSubmitted } from "../registration/registration-schemas";
import {
    getAsStaff,
    getAsUser,
    putAsStaff,
    delAsStaff,
    delAsUser,
    putAsUser,
    getAsAttendee,
    putAsApplicant,
    TESTER,
} from "../../common/testTools";
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
    proChallengeScore: 0,
} satisfies AdmissionDecision;

const OTHER_DECISION = {
    userId: "other-user",
    status: DecisionStatus.REJECTED,
    response: DecisionResponse.DECLINED,
    emailSent: true,
    admittedPro: false,
    reimbursementValue: 0,
    correctProChallenge: false,
    proChallengeScore: 0,
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
        expect(JSON.parse(response.text).reviews).toEqual([
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
        expect(JSON.parse(response.text).reviews).toEqual([{ reviewerId: "other-staff-1", score: 3, comment: "Decent" }]);
    });

    it("returns an empty list and empty scores for an application with no reviews", async () => {
        const response = await getAsStaff(`/admission/review/${TESTER.id}/`).expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toEqual({
            reviews: [],
            aiScore: null,
            aiReasons: [],
            aiGradedAt: null,
            finalScore: null,
            finalScoreSetBy: null,
            finalScoreSetAt: null,
        });
    });

    it("returns the AI score, AI reasons and final score", async () => {
        await Models.RegistrationApplicationSubmitted.updateOne(
            { userId: TESTER.id },
            {
                aiScore: 3,
                aiReasons: ["Clear essays", "Short answers"],
                aiGradedAt: 1000,
                finalScore: 4,
                finalScoreSetBy: "other-staff-1",
                finalScoreSetAt: 2000,
            },
        );

        const response = await getAsStaff(`/admission/review/${TESTER.id}/`).expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject({
            aiScore: 3,
            aiReasons: ["Clear essays", "Short answers"],
            aiGradedAt: 1000,
            finalScore: 4,
            finalScoreSetBy: "other-staff-1",
            finalScoreSetAt: 2000,
        });
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

async function getFinalScore(userId: string): Promise<unknown> {
    const application = await Models.RegistrationApplicationSubmitted.findOne({ userId })
        .select("+finalScore +finalScoreSetBy +finalScoreSetAt")
        .lean();
    return {
        finalScore: application?.finalScore,
        finalScoreSetBy: application?.finalScoreSetBy,
        finalScoreSetAt: application?.finalScoreSetAt,
    };
}

describe("final score on PUT /admission/review/:id/", () => {
    it("sets the final score, who set it, and when", async () => {
        const before = Date.now();
        await putAsStaff(`/admission/review/${TESTER.id}/`).send({ score: 4 }).expect(StatusCode.SuccessOK);

        expect(await getFinalScore(TESTER.id)).toEqual({
            finalScore: 4,
            finalScoreSetBy: TESTER.id,
            finalScoreSetAt: expect.any(Number),
        });
        const { finalScoreSetAt } = (await getFinalScore(TESTER.id)) as { finalScoreSetAt: number };
        expect(finalScoreSetAt).toBeGreaterThanOrEqual(before);
        expect(finalScoreSetAt).toBeLessThanOrEqual(Date.now());
    });

    it("keeps the last score set instead of averaging", async () => {
        await Models.RegistrationApplicationSubmitted.create({ ...REVIEWED_APPLICATION, finalScore: 2, finalScoreSetBy: "ai" });
        await putAsStaff(`/admission/review/${REVIEWED_APPLICATION.userId}/`).send({ score: 5 }).expect(StatusCode.SuccessOK);
        expect(await getFinalScore(REVIEWED_APPLICATION.userId)).toMatchObject({ finalScore: 5, finalScoreSetBy: TESTER.id });

        await putAsStaff(`/admission/review/${REVIEWED_APPLICATION.userId}/`).send({ score: 1 }).expect(StatusCode.SuccessOK);
        expect(await getFinalScore(REVIEWED_APPLICATION.userId)).toMatchObject({ finalScore: 1, finalScoreSetBy: TESTER.id });
    });

    it("overwrites the final score set by another reviewer", async () => {
        await Models.RegistrationApplicationSubmitted.create({
            ...REVIEWED_APPLICATION,
            finalScore: 3,
            finalScoreSetBy: "other-staff-1",
            finalScoreSetAt: 1000,
        });
        await putAsStaff(`/admission/review/${REVIEWED_APPLICATION.userId}/`).send({ score: 2 }).expect(StatusCode.SuccessOK);

        const result = (await getFinalScore(REVIEWED_APPLICATION.userId)) as { finalScoreSetAt: number };
        expect(result).toMatchObject({ finalScore: 2, finalScoreSetBy: TESTER.id });
        expect(result.finalScoreSetAt).toBeGreaterThan(1000);
    });

    it("leaves the final score alone when the score is invalid", async () => {
        await putAsStaff(`/admission/review/${TESTER.id}/`).send({ score: 9 }).expect(StatusCode.ClientErrorBadRequest);
        expect(await getFinalScore(TESTER.id)).toEqual({ finalScore: null, finalScoreSetBy: null, finalScoreSetAt: null });
    });
});

describe("PUT /admission/review/:id/reviewers/", () => {
    beforeEach(async () => {
        await Models.RegistrationApplicationSubmitted.create(REVIEWED_APPLICATION);
    });

    it("gives forbidden error for user without elevated perms", async () => {
        const response = await putAsUser(`/admission/review/${REVIEWED_APPLICATION.userId}/reviewers/`)
            .send({ reviewerId: "new-reviewer" })
            .expect(StatusCode.ClientErrorForbidden);
        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("adds a pending review for the reviewer", async () => {
        await putAsStaff(`/admission/review/${REVIEWED_APPLICATION.userId}/reviewers/`)
            .send({ reviewerId: "new-reviewer" })
            .expect(StatusCode.SuccessOK);

        expect(await getReviews(REVIEWED_APPLICATION.userId)).toMatchObject({
            reviews: [...REVIEWED_APPLICATION.reviews, { reviewerId: "new-reviewer", score: null }],
            reviewCount: 3,
        });
    });

    it("does nothing when the reviewer is already pending", async () => {
        const url = `/admission/review/${REVIEWED_APPLICATION.userId}/reviewers/`;
        await putAsStaff(url).send({ reviewerId: "new-reviewer" }).expect(StatusCode.SuccessOK);
        await putAsStaff(url).send({ reviewerId: "new-reviewer" }).expect(StatusCode.SuccessOK);

        const { reviews, reviewCount } = await getReviews(REVIEWED_APPLICATION.userId);
        expect(reviews).toHaveLength(3);
        expect(reviewCount).toBe(3);
    });

    it("keeps the score when the reviewer has already scored", async () => {
        await putAsStaff(`/admission/review/${REVIEWED_APPLICATION.userId}/reviewers/`)
            .send({ reviewerId: "other-staff-1" })
            .expect(StatusCode.SuccessOK);

        expect(await getReviews(REVIEWED_APPLICATION.userId)).toMatchObject({
            reviews: REVIEWED_APPLICATION.reviews,
            reviewCount: 2,
        });
    });

    it("lets the new reviewer score the application afterwards", async () => {
        await putAsStaff(`/admission/review/${REVIEWED_APPLICATION.userId}/reviewers/`)
            .send({ reviewerId: TESTER.id })
            .expect(StatusCode.SuccessOK);
        const next = await getAsStaff("/admission/review/next/").expect(StatusCode.SuccessOK);
        expect(JSON.parse(next.text)).toHaveProperty("userId", REVIEWED_APPLICATION.userId);
    });

    it("rejects a body without a reviewer id", async () => {
        const response = await putAsStaff(`/admission/review/${REVIEWED_APPLICATION.userId}/reviewers/`)
            .send({})
            .expect(StatusCode.ClientErrorBadRequest);
        expect(JSON.parse(response.text)).toHaveProperty("error", "BadRequest");
    });

    it("gives not found for an application that does not exist", async () => {
        const response = await putAsStaff("/admission/review/nonexistent-user/reviewers/")
            .send({ reviewerId: "new-reviewer" })
            .expect(StatusCode.ClientErrorNotFound);
        expect(JSON.parse(response.text)).toHaveProperty("error", "NotFound");
    });
});

describe("DELETE /admission/review/:id/reviewers/:reviewerId/", () => {
    beforeEach(async () => {
        await Models.RegistrationApplicationSubmitted.create({
            ...REVIEWED_APPLICATION,
            reviews: [...REVIEWED_APPLICATION.reviews, { reviewerId: "pending-reviewer", score: null }],
            reviewCount: 3,
        });
    });

    it("gives forbidden error for user without elevated perms", async () => {
        const response = await delAsUser(`/admission/review/${REVIEWED_APPLICATION.userId}/reviewers/pending-reviewer/`).expect(
            StatusCode.ClientErrorForbidden,
        );
        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("removes a pending review", async () => {
        await delAsStaff(`/admission/review/${REVIEWED_APPLICATION.userId}/reviewers/pending-reviewer/`).expect(
            StatusCode.SuccessOK,
        );

        expect(await getReviews(REVIEWED_APPLICATION.userId)).toMatchObject({
            reviews: REVIEWED_APPLICATION.reviews,
            reviewCount: 2,
        });
    });

    it("clears the reviewer's tracked assignment for that application", async () => {
        await Models.ApplicationReviewAssignment.create({
            _id: "pending-reviewer",
            userId: REVIEWED_APPLICATION.userId,
            reviewCount: 2,
        });
        await delAsStaff(`/admission/review/${REVIEWED_APPLICATION.userId}/reviewers/pending-reviewer/`).expect(
            StatusCode.SuccessOK,
        );

        expect(await Models.ApplicationReviewAssignment.exists({ _id: "pending-reviewer" })).toBeNull();
    });

    it("refuses to remove a reviewer who has scored", async () => {
        const response = await delAsStaff(`/admission/review/${REVIEWED_APPLICATION.userId}/reviewers/other-staff-1/`).expect(
            StatusCode.ClientErrorConflict,
        );
        expect(JSON.parse(response.text)).toHaveProperty("error", "ReviewAlreadyScored");
        expect((await getReviews(REVIEWED_APPLICATION.userId)).reviews).toHaveLength(3);
    });

    it("does nothing for a reviewer who is not assigned", async () => {
        await delAsStaff(`/admission/review/${REVIEWED_APPLICATION.userId}/reviewers/nobody/`).expect(StatusCode.SuccessOK);
        expect(await getReviews(REVIEWED_APPLICATION.userId)).toMatchObject({ reviewCount: 3 });
    });

    it("gives not found for an application that does not exist", async () => {
        const response = await delAsStaff("/admission/review/nonexistent-user/reviewers/pending-reviewer/").expect(
            StatusCode.ClientErrorNotFound,
        );
        expect(JSON.parse(response.text)).toHaveProperty("error", "NotFound");
    });
});

// One application per tag, so the filters have something to tell apart
const APPLICANT_SETUP = [
    { userId: "in-review-user", email: "in-review@test.org", decision: null },
    { userId: "tbd-user", email: "tbd@test.org", decision: { status: DecisionStatus.TBD, reimbursementValue: 0 } },
    { userId: "admitted-user", email: "admitted@test.org", decision: { status: DecisionStatus.ACCEPTED, reimbursementValue: 0 } },
    {
        userId: "reimbursed-user",
        email: "reimbursed@test.org",
        decision: { status: DecisionStatus.ACCEPTED, reimbursementValue: 150 },
    },
    {
        userId: "waitlisted-user",
        email: "waitlisted@test.org",
        decision: { status: DecisionStatus.WAITLISTED, reimbursementValue: 0 },
    },
    { userId: "rejected-user", email: "rejected@test.org", decision: { status: DecisionStatus.REJECTED, reimbursementValue: 0 } },
];

async function createApplicants(): Promise<void> {
    for (const { userId, email, decision } of APPLICANT_SETUP) {
        await Models.RegistrationApplicationSubmitted.create({
            ...TESTER_APPLICATION,
            userId,
            email,
            firstName: userId,
            lastName: "Last",
            reviews: [],
            reviewCount: 0,
        });
        if (decision) {
            await Models.AdmissionDecision.create({ ...OTHER_DECISION, userId, ...decision });
        }
    }
}

describe("GET /admission/applicants/", () => {
    beforeEach(async () => {
        await Models.RegistrationApplicationSubmitted.deleteMany({});
        await Models.AdmissionDecision.deleteMany({});
        await createApplicants();
    });

    async function list(query = ""): Promise<Array<Record<string, unknown>>> {
        const response = await getAsStaff(`/admission/applicants/${query}`).expect(StatusCode.SuccessOK);
        return JSON.parse(response.text);
    }

    it("gives forbidden error for user without elevated perms", async () => {
        const response = await getAsUser("/admission/applicants/").expect(StatusCode.ClientErrorForbidden);
        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("returns one row per application with its details", async () => {
        const rows = await list();
        expect(rows).toHaveLength(APPLICANT_SETUP.length);
        expect(rows.find((row) => row.userId === "admitted-user")).toEqual({
            userId: "admitted-user",
            name: "admitted-user Last",
            email: "admitted@test.org",
            school: TESTER_APPLICATION.school,
            reviewers: [],
            aiScore: null,
            finalScore: null,
            edited: false,
            aiGradeFailed: false,
            tag: "ADMITTED",
        });
    });

    it("flags applications whose AI grading failed and that have no AI score", async () => {
        await Models.RegistrationApplicationSubmitted.updateOne({ userId: "admitted-user" }, { aiGradeFailedAt: 5 });
        await Models.RegistrationApplicationSubmitted.updateOne({ userId: "rejected-user" }, { aiGradeFailedAt: 5, aiScore: 3 });
        const rows = await list();
        expect(rows.find((row) => row.userId === "admitted-user")).toHaveProperty("aiGradeFailed", true);
        expect(rows.find((row) => row.userId === "rejected-user")).toHaveProperty("aiGradeFailed", false);
        expect(rows.find((row) => row.userId === "tbd-user")).toHaveProperty("aiGradeFailed", false);
    });

    it.each([
        ["in-review-user", "IN_REVIEW"],
        ["tbd-user", "IN_REVIEW"],
        ["admitted-user", "ADMITTED"],
        ["reimbursed-user", "ADMITTED_REIMBURSED"],
        ["waitlisted-user", "WAITLISTED"],
        ["rejected-user", "REJECTED"],
    ])("tags %s as %s", async (userId, tag) => {
        const rows = await list();
        expect(rows.find((row) => row.userId === userId)).toHaveProperty("tag", tag);
    });

    it("filters by tag", async () => {
        const rows = await list("?tag=IN_REVIEW");
        expect(rows.map((row) => row.userId).sort()).toEqual(["in-review-user", "tbd-user"]);
        expect((await list("?tag=ADMITTED_REIMBURSED")).map((row) => row.userId)).toEqual(["reimbursed-user"]);
    });

    it("rejects an unknown tag", async () => {
        const response = await getAsStaff("/admission/applicants/?tag=MAYBE").expect(StatusCode.ClientErrorBadRequest);
        expect(JSON.parse(response.text)).toHaveProperty("error", "BadRequest");
    });

    it("lists reviewers with their names and scores, including pending ones", async () => {
        await Models.UserInfo.create({ userId: "r1", name: "Rae Reviewer", email: "rae@example.org" });
        await Models.RegistrationApplicationSubmitted.updateOne(
            { userId: "admitted-user" },
            {
                reviews: [
                    { reviewerId: "r1", score: 4 },
                    { reviewerId: "r2", score: null },
                ],
                reviewCount: 2,
            },
        );
        const row = (await list()).find((entry) => entry.userId === "admitted-user");
        // r2 has no user info, so the name is null
        expect(row).toHaveProperty("reviewers", [
            { reviewerId: "r1", name: "Rae Reviewer", score: 4 },
            { reviewerId: "r2", name: null, score: null },
        ]);
    });

    it("filters by reviewer, and by none for applications without reviewers", async () => {
        await Models.RegistrationApplicationSubmitted.updateOne(
            { userId: "admitted-user" },
            { reviews: [{ reviewerId: "r1", score: 4 }], reviewCount: 1 },
        );
        expect((await list("?reviewerId=r1")).map((row) => row.userId)).toEqual(["admitted-user"]);
        const none = (await list("?reviewerId=none")).map((row) => row.userId);
        expect(none).toHaveLength(APPLICANT_SETUP.length - 1);
        expect(none).not.toContain("admitted-user");
    });

    it("combines the tag and reviewer filters", async () => {
        await Models.RegistrationApplicationSubmitted.updateMany(
            { userId: { $in: ["admitted-user", "rejected-user"] } },
            { reviews: [{ reviewerId: "r1", score: 4 }], reviewCount: 1 },
        );
        expect((await list("?tag=REJECTED&reviewerId=r1")).map((row) => row.userId)).toEqual(["rejected-user"]);
    });

    it("marks a score as edited when a reviewer changed the AI score", async () => {
        await Models.RegistrationApplicationSubmitted.updateOne(
            { userId: "admitted-user" },
            { aiScore: 3, finalScore: 5, finalScoreSetBy: "r1", finalScoreSetAt: 1 },
        );
        await Models.RegistrationApplicationSubmitted.updateOne(
            { userId: "rejected-user" },
            { aiScore: 3, finalScore: 3, finalScoreSetBy: "ai", finalScoreSetAt: 1 },
        );
        await Models.RegistrationApplicationSubmitted.updateOne(
            { userId: "waitlisted-user" },
            { aiScore: 3, finalScore: 3, finalScoreSetBy: "r1", finalScoreSetAt: 1 },
        );
        await Models.RegistrationApplicationSubmitted.updateOne(
            { userId: "tbd-user" },
            { finalScore: 2, finalScoreSetBy: "r1", finalScoreSetAt: 1 },
        );

        const rows = await list();
        const edited = (userId: string): unknown => rows.find((row) => row.userId === userId)?.edited;
        expect(rows.find((row) => row.userId === "admitted-user")).toMatchObject({ aiScore: 3, finalScore: 5 });
        expect(edited("admitted-user")).toBe(true);
        expect(edited("rejected-user")).toBe(false);
        expect(edited("waitlisted-user")).toBe(false);
        expect(edited("tbd-user")).toBe(false);
    });
});

describe("GET /admission/applicants/emails/", () => {
    beforeEach(async () => {
        await Models.RegistrationApplicationSubmitted.deleteMany({});
        await Models.AdmissionDecision.deleteMany({});
        await createApplicants();
    });

    it("gives forbidden error for user without elevated perms", async () => {
        const response = await getAsUser("/admission/applicants/emails/?tag=ADMITTED").expect(StatusCode.ClientErrorForbidden);
        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("returns the emails of applicants with the tag", async () => {
        const response = await getAsStaff("/admission/applicants/emails/?tag=IN_REVIEW").expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text).emails.sort()).toEqual(["in-review@test.org", "tbd@test.org"]);

        const admitted = await getAsStaff("/admission/applicants/emails/?tag=ADMITTED").expect(StatusCode.SuccessOK);
        expect(JSON.parse(admitted.text)).toEqual({ emails: ["admitted@test.org"] });
    });

    it("returns an empty list when nobody has the tag", async () => {
        await Models.AdmissionDecision.deleteOne({ userId: "rejected-user" });
        const response = await getAsStaff("/admission/applicants/emails/?tag=REJECTED").expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toEqual({ emails: [] });
    });

    it("requires a valid tag", async () => {
        await getAsStaff("/admission/applicants/emails/").expect(StatusCode.ClientErrorBadRequest);
        await getAsStaff("/admission/applicants/emails/?tag=MAYBE").expect(StatusCode.ClientErrorBadRequest);
    });
});

describe("PUT /admission/applicants/:id/tag/", () => {
    let sendMail: jest.SpiedFunction<typeof MailLib.sendMail> = undefined!;
    let sendBulkMail: jest.SpiedFunction<typeof MailLib.sendBulkMail> = undefined!;

    beforeEach(async () => {
        sendMail = mockSendMail();
        sendMail.mockImplementation(async () => "");
        sendBulkMail = mockSendBulkMail();
        sendBulkMail.mockImplementation(async () => ({ success: true, successCount: 0, failedCount: 0, errors: [] }));
    });

    const tagUrl = (id: string): string => `/admission/applicants/${id}/tag/`;
    const getDecision = async (id: string): Promise<AdmissionDecision | null> =>
        Models.AdmissionDecision.findOne({ userId: id }).lean();

    it("gives forbidden error for user without elevated perms", async () => {
        const response = await putAsUser(tagUrl(TESTER.id)).send({ tag: "REJECTED" }).expect(StatusCode.ClientErrorForbidden);
        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("returns not found when the user has no submitted application", async () => {
        const response = await putAsStaff(tagUrl("nobody")).send({ tag: "REJECTED" }).expect(StatusCode.ClientErrorNotFound);
        expect(JSON.parse(response.text)).toHaveProperty("error", "NotFound");
        expect(await getDecision("nobody")).toBeNull();
    });

    it("rejects an unknown tag", async () => {
        await putAsStaff(tagUrl(TESTER.id)).send({ tag: "MAYBE" }).expect(StatusCode.ClientErrorBadRequest);
    });

    it("keeps and returns the existing pro challenge score", async () => {
        await Models.AdmissionDecision.updateOne({ userId: TESTER.id }, { proChallengeScore: 0.87 });
        const response = await putAsStaff(tagUrl(TESTER.id)).send({ tag: "WAITLISTED" }).expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toHaveProperty("proChallengeScore", 0.87);
        expect(await getDecision(TESTER.id)).toMatchObject({ proChallengeScore: 0.87 });
    });

    it("sets IN_REVIEW as status TBD", async () => {
        const response = await putAsStaff(tagUrl(TESTER.id)).send({ tag: "IN_REVIEW" }).expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject({ userId: TESTER.id, tag: "IN_REVIEW", status: DecisionStatus.TBD });
        expect(await getDecision(TESTER.id)).toMatchObject({ status: DecisionStatus.TBD });
    });

    it("sets ADMITTED as ACCEPTED with reimbursement 0, ignoring a given value", async () => {
        await Models.AdmissionDecision.updateOne(
            { userId: TESTER.id },
            { status: DecisionStatus.REJECTED, reimbursementValue: 50 },
        );
        const response = await putAsStaff(tagUrl(TESTER.id))
            .send({ tag: "ADMITTED", reimbursementValue: 99 })
            .expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject({ tag: "ADMITTED", status: "ACCEPTED", reimbursementValue: 0 });
        expect(await getDecision(TESTER.id)).toMatchObject({ status: DecisionStatus.ACCEPTED, reimbursementValue: 0 });
    });

    it("sets ADMITTED_REIMBURSED as ACCEPTED with the given value", async () => {
        const response = await putAsStaff(tagUrl(TESTER.id))
            .send({ tag: "ADMITTED_REIMBURSED", reimbursementValue: 75 })
            .expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject({
            tag: "ADMITTED_REIMBURSED",
            status: "ACCEPTED",
            reimbursementValue: 75,
        });
        expect(await getDecision(TESTER.id)).toMatchObject({ status: DecisionStatus.ACCEPTED, reimbursementValue: 75 });
    });

    it("requires a positive reimbursement value for ADMITTED_REIMBURSED", async () => {
        await putAsStaff(tagUrl(TESTER.id)).send({ tag: "ADMITTED_REIMBURSED" }).expect(StatusCode.ClientErrorBadRequest);
        await putAsStaff(tagUrl(TESTER.id))
            .send({ tag: "ADMITTED_REIMBURSED", reimbursementValue: 0 })
            .expect(StatusCode.ClientErrorBadRequest);
        await putAsStaff(tagUrl(TESTER.id))
            .send({ tag: "ADMITTED_REIMBURSED", reimbursementValue: -5 })
            .expect(StatusCode.ClientErrorBadRequest);
        expect(await getDecision(TESTER.id)).toMatchObject({ status: DecisionStatus.ACCEPTED, reimbursementValue: 0 });
    });

    it("sets WAITLISTED and REJECTED and zeroes the reimbursement", async () => {
        await Models.AdmissionDecision.updateOne({ userId: TESTER.id }, { reimbursementValue: 40 });
        let response = await putAsStaff(tagUrl(TESTER.id)).send({ tag: "WAITLISTED" }).expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject({ tag: "WAITLISTED", status: "WAITLISTED", reimbursementValue: 0 });
        response = await putAsStaff(tagUrl(TESTER.id)).send({ tag: "REJECTED" }).expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject({ tag: "REJECTED", status: "REJECTED", reimbursementValue: 0 });
        expect(await getDecision(TESTER.id)).toMatchObject({ status: DecisionStatus.REJECTED, reimbursementValue: 0 });
    });

    it("creates a decision when the applicant has none", async () => {
        await Models.AdmissionDecision.deleteOne({ userId: TESTER.id });
        const response = await putAsStaff(tagUrl(TESTER.id)).send({ tag: "WAITLISTED" }).expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject({ tag: "WAITLISTED", emailSent: false });
        expect(await getDecision(TESTER.id)).toMatchObject({
            status: DecisionStatus.WAITLISTED,
            response: DecisionResponse.PENDING,
            emailSent: false,
        });
    });

    it("saves a changed reimbursement within ACCEPTED and marks the email as not sent", async () => {
        await Models.AdmissionDecision.updateOne(
            { userId: TESTER.id },
            { reimbursementValue: 20, emailSent: true, admittedPro: true },
        );
        const response = await putAsStaff(tagUrl(TESTER.id))
            .send({ tag: "ADMITTED_REIMBURSED", reimbursementValue: 35 })
            .expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject({ reimbursementValue: 35, emailSent: false, admittedPro: true });
        expect(await getDecision(TESTER.id)).toMatchObject({ reimbursementValue: 35, emailSent: false, admittedPro: true });
    });

    it("keeps emailSent when nothing changes", async () => {
        await Models.AdmissionDecision.updateOne({ userId: TESTER.id }, { emailSent: true });
        await putAsStaff(tagUrl(TESTER.id)).send({ tag: "ADMITTED" }).expect(StatusCode.SuccessOK);
        expect(await getDecision(TESTER.id)).toMatchObject({ status: DecisionStatus.ACCEPTED, emailSent: true });
    });

    it("marks the email as not sent when the status changes, and keeps other fields", async () => {
        await Models.AdmissionDecision.updateOne(
            { userId: TESTER.id },
            { emailSent: true, admittedPro: true, response: DecisionResponse.ACCEPTED },
        );
        await putAsStaff(tagUrl(TESTER.id)).send({ tag: "WAITLISTED" }).expect(StatusCode.SuccessOK);
        expect(await getDecision(TESTER.id)).toMatchObject({
            status: DecisionStatus.WAITLISTED,
            emailSent: false,
            admittedPro: true,
            response: DecisionResponse.ACCEPTED,
        });
    });

    it("never sends email", async () => {
        for (const body of [
            { tag: "IN_REVIEW" },
            { tag: "ADMITTED" },
            { tag: "ADMITTED_REIMBURSED", reimbursementValue: 10 },
            { tag: "WAITLISTED" },
            { tag: "REJECTED" },
        ]) {
            await putAsStaff(tagUrl(TESTER.id)).send(body).expect(StatusCode.SuccessOK);
        }
        expect(sendMail).not.toHaveBeenCalled();
        expect(sendBulkMail).not.toHaveBeenCalled();
    });
});
