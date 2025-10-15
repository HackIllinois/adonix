import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { SpiedFunction } from "jest-mock";
import { RequestHandler } from "express";
import { StatusCode } from "status-code-enum";
import {
    TESTER,
    delAsAdmin,
    delAsStaff,
    get,
    getAsAttendee,
    getAsStaff,
    getAsUser,
    post,
    putAsAdmin,
    putAsStaff,
} from "../../common/testTools";
import { Templates } from "../../common/config";
import * as selectAuthMiddleware from "../../middleware/select-auth";
import { mockGenerateJwtTokenWithWrapper } from "../../common/mocks/auth";
import { AuthCode, JwtPayload, ProfileData, Provider, Role } from "./auth-schemas";
import Models from "../../common/models";
import { AuthInfo } from "./auth-schemas";
import { UserInfo } from "../user/user-schemas";
import type * as MailLib from "../mail/mail-lib";
import { Sponsor } from "../sponsor/sponsor-schemas";
import { AxiosResponse } from "axios";
import { generateJwtToken } from "../../common/auth";

const USER = {
    userId: "user",
    provider: "github",
    roles: [Role.USER],
} satisfies AuthInfo;

const USER_ATTENDEE = {
    userId: "attendee",
    provider: "github",
    roles: [Role.USER, Role.ATTENDEE],
} satisfies AuthInfo;

const USER_STAFF = {
    userId: "staff",
    provider: "github",
    roles: [Role.USER, Role.ATTENDEE, Role.STAFF],
} satisfies AuthInfo;

const SPONSOR = {
    email: "example@sponsor.com",
    userId: "sponsor1234",
} satisfies Sponsor;

const USER_INFO = {
    userId: "user",
    name: "User Name",
    email: "example@user.com",
} satisfies UserInfo;

const USER_ATTENDEE_INFO = {
    userId: "attendee",
    name: "Attendee Name",
    email: "example@attendee.com",
} satisfies UserInfo;

const USER_STAFF_INFO = {
    userId: "staff",
    name: "Staff Name",
    email: "example@staff.com",
} satisfies UserInfo;

const SPONSOR_CODE = {
    email: SPONSOR.email,
    code: "123456",
    expiry: Math.floor(Date.now() / 1000) + 300,
} satisfies AuthCode;

const EXPIRED_SPONSOR_CODE = {
    ...SPONSOR_CODE,
    expiry: Math.floor(Date.now() / 1000) - 300,
} satisfies AuthCode;

beforeEach(async () => {
    await Models.AuthInfo.create(USER);
    await Models.AuthInfo.create(USER_ATTENDEE);
    await Models.AuthInfo.create(USER_STAFF);
    await Models.Sponsor.create(SPONSOR);
    await Models.UserInfo.create(USER_INFO);
    await Models.UserInfo.create(USER_ATTENDEE_INFO);
    await Models.UserInfo.create(USER_STAFF_INFO);
});

/*
 * Mocks generateJwtToken with a wrapper so calls and returns can be examined. Does not change behavior.
 */
function mockSelectAuthProvider(handler: RequestHandler): SpiedFunction<typeof selectAuthMiddleware.SelectAuthProvider> {
    const mockedSelectAuthMiddleware = require("../../middleware/select-auth") as typeof selectAuthMiddleware;
    const mockedSelectAuthProvider = jest.spyOn(mockedSelectAuthMiddleware, "SelectAuthProvider");
    mockedSelectAuthProvider.mockImplementation(() => handler);
    return mockedSelectAuthProvider;
}

describe.each(["github", "google"])("GET /auth/login/%s/", (provider) => {
    let mockedSelectAuthProvider: SpiedFunction<typeof selectAuthMiddleware.SelectAuthProvider>;

    beforeEach(() => {
        mockedSelectAuthProvider = mockSelectAuthProvider((_req, res, _next) => {
            res.status(StatusCode.SuccessOK).send();
        });
    });

    it("provides an error when an invalid device is provided", async () => {
        const response = await get(`/auth/login/${provider}/?device=abc`).expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "BadRequest");
    });

    it("provides an error when an invalid redirect is provided", async () => {
        const response = await get(`/auth/login/${provider}/?redirect=https://google.com/`).expect(
            StatusCode.ClientErrorBadRequest,
        );

        expect(JSON.parse(response.text)).toHaveProperty("error", "BadRedirectUrl");
    });

    it("logs in with localhost redirect url", async () => {
        const redirect = "http://localhost:3000/register/";
        await get(`/auth/login/${provider}/?redirect=${redirect}`).expect(StatusCode.SuccessOK);

        expect(mockedSelectAuthProvider).toBeCalledWith(provider, redirect);
    });

    it("logs in with deploy preview redirect url", async () => {
        const redirect = "https://deploy-preview-311--hackillinois.netlify.app/profile";
        await get(`/auth/login/${provider}/?redirect=${redirect}`).expect(StatusCode.SuccessOK);

        expect(mockedSelectAuthProvider).toBeCalledWith(provider, redirect);
    });

    it("logs in with production redirect url", async () => {
        const redirect = "https://admin.hackillinois.org/admissions/";
        await get(`/auth/login/${provider}/?redirect=${redirect}`).expect(StatusCode.SuccessOK);

        expect(mockedSelectAuthProvider).toBeCalledWith(provider, redirect);
    });
});

describe("GET /auth/:provider/callback/?state=redirect", () => {
    let mockedGenerateJwtToken: ReturnType<typeof mockGenerateJwtTokenWithWrapper>;

    beforeEach(() => {
        mockSelectAuthProvider((_req, _res, _next) => {
            console.error("Select auth provider called when it shouldn't be!");
        });
        mockedGenerateJwtToken = mockGenerateJwtTokenWithWrapper();
    });

    it("provides an error when an invalid redirect is provided", async () => {
        const response = await get("/auth/github/callback/?state=https://google.com/").expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "BadRedirectUrl");
    });

    it("provides an error when authentication fails", async () => {
        // Mock select auth to return not authenticated
        mockSelectAuthProvider((req, _res, next) => {
            req.isAuthenticated = ((): boolean => false) as typeof req.isAuthenticated;

            next();
        });

        const response = await get("/auth/github/callback/?state=https://hackillinois.org/").expect(
            StatusCode.ClientErrorUnauthorized,
        );

        expect(JSON.parse(response.text)).toHaveProperty("error", "AuthenticationFailed");
    });

    it("works when authentication passes with redirect url", async () => {
        const profileData = {
            id: "123",
            email: "test@gmail.com",
        } satisfies ProfileData;
        const provider = Provider.GITHUB;
        const redirectUrl = "https://hackillinois.org/profile";

        // Mock select auth to successfully authenticate & return user data
        mockSelectAuthProvider((req, _res, next) => {
            req.isAuthenticated = ((): boolean => true) as typeof req.isAuthenticated;

            req.user = {
                provider,
                _json: profileData,
            };

            next();
        });

        const response = await get(`/auth/github/callback/?state=${redirectUrl}`).expect(StatusCode.RedirectFound);

        expect(mockedGenerateJwtToken).toBeCalledWith(
            expect.objectContaining({
                id: `${provider}${profileData.id}`,
                email: profileData.email,
                provider,
                roles: [Role.USER],
            } satisfies JwtPayload),
            false,
        );

        // Expect redirect to be to the correct url (without token) and JWT cookie to be set
        expect(response.headers["location"]).toBe(redirectUrl);
        expect(response.headers["set-cookie"]).toEqual(
            expect.arrayContaining([expect.stringContaining("jwt="), expect.stringContaining("HttpOnly")]),
        );
    });
});

describe("POST /auth/token/", () => {
    it("returns JWT token when valid authenticated cookie is present", async () => {
        await Models.AuthInfo.create({
            userId: TESTER.id,
            provider: "github",
            roles: [Role.USER],
        });

        const payload = {
            id: TESTER.id,
            email: "test@example.com",
            provider: "github",
            roles: [Role.USER],
        };

        const realJwt = generateJwtToken(payload, false);

        const response = await get("/auth/token/").set("Cookie", `jwt=${realJwt}`).expect(StatusCode.SuccessOK);

        const json = JSON.parse(response.text);
        expect(json).toHaveProperty("jwt", realJwt);
    });

    it("returns error when no authentication is provided", async () => {
        const response = await get("/auth/token/").expect(StatusCode.ClientErrorUnauthorized);

        const json = JSON.parse(response.text);
        expect(json).toHaveProperty("error", "NoToken");
    });

    it("returns error when empty cookie is provided", async () => {
        const response = await get("/auth/token/").set("Cookie", "jwt=").expect(StatusCode.ClientErrorUnauthorized);

        const json = JSON.parse(response.text);
        expect(json).toHaveProperty("error", "NoToken");
    });
});

function mockSendMail(): jest.SpiedFunction<typeof MailLib.sendMail> {
    const mailLib = require("../../services/mail/mail-lib") as typeof MailLib;
    return jest.spyOn(mailLib, "sendMail");
}

describe("POST /auth/sponsor/verify/", () => {
    let sendMail: jest.SpiedFunction<typeof MailLib.sendMail> = undefined!;

    beforeEach(async () => {
        // Mock successful send by default
        sendMail = mockSendMail();
        sendMail.mockImplementation(async (_) => ({}) as AxiosResponse);
    });

    it("sends an email with code", async () => {
        await post(`/auth/sponsor/verify/?email=${encodeURIComponent(SPONSOR.email)}`).expect(StatusCode.SuccessOK);

        const authCode = await Models.AuthCode.findOne({ email: SPONSOR.email });

        expect(authCode).not.toBeNull();
        expect(authCode).toMatchObject(
            expect.objectContaining({
                email: SPONSOR.email,
                code: expect.any(String),
                expiry: expect.any(Number),
            }),
        );
        expect(authCode?.expiry).toBeGreaterThan(Math.floor(Date.now() / 1000) + 60);

        expect(sendMail).toBeCalledWith({
            recipients: [SPONSOR.email],
            subs: {
                code: authCode?.code,
            },
            templateId: Templates.SPONSOR_VERIFICATION_CODE,
        });
    });

    it("sends an email with code and updated existing", async () => {
        await Models.AuthCode.create(EXPIRED_SPONSOR_CODE);
        await post(`/auth/sponsor/verify/?email=${encodeURIComponent(SPONSOR.email)}`).expect(StatusCode.SuccessOK);

        const authCode = await Models.AuthCode.findOne({ email: SPONSOR.email });

        expect(authCode).not.toBeNull();
        expect(authCode).toMatchObject(
            expect.objectContaining({
                email: SPONSOR.email,
                code: expect.any(String),
                expiry: expect.any(Number),
            }),
        );
        expect(authCode?.expiry).toBeGreaterThan(Math.floor(Date.now() / 1000) + 60);

        expect(sendMail).toBeCalledWith({
            recipients: [SPONSOR.email],
            subs: {
                code: authCode?.code,
            },
            templateId: Templates.SPONSOR_VERIFICATION_CODE,
        });
    });

    it("ignores an invalid email", async () => {
        await post(`/auth/sponsor/verify/?email=${encodeURIComponent("bleh@bleh.com")}`).expect(StatusCode.SuccessOK);

        const authCode = await Models.AuthCode.findOne({ email: SPONSOR.email });

        expect(authCode).toBeNull();
        expect(sendMail).not.toBeCalled();
    });
});

describe("POST /auth/sponsor/login/", () => {
    let mockedGenerateJwtToken: ReturnType<typeof mockGenerateJwtTokenWithWrapper>;

    beforeEach(() => {
        mockSelectAuthProvider((_req, _res, _next) => {
            console.error("Select auth provider called when it shouldn't be!");
        });
        mockedGenerateJwtToken = mockGenerateJwtTokenWithWrapper();
    });

    it("logs in with a valid code", async () => {
        await Models.AuthCode.create(SPONSOR_CODE);
        const response = await post(`/auth/sponsor/login`)
            .send({
                code: SPONSOR_CODE.code,
                email: SPONSOR.email,
            })
            .expect(StatusCode.SuccessOK);

        expect(mockedGenerateJwtToken).toBeCalledWith(
            expect.objectContaining({
                email: SPONSOR.email,
                id: SPONSOR.userId,
                provider: Provider.SPONSOR,
                roles: [Role.USER, Role.SPONSOR],
            } satisfies JwtPayload),
            false,
        );

        expect(JSON.parse(response.text)).toMatchObject({ success: true });
        expect(response.headers["set-cookie"]).toBeDefined();

        const authCode = await Models.AuthCode.findOne({ email: SPONSOR.email });
        expect(authCode).toBeNull();
    });

    it("fails to log in with a invalid code", async () => {
        await Models.AuthCode.create(SPONSOR_CODE);
        const response = await post(`/auth/sponsor/login`)
            .send({
                code: "incorrect",
                email: SPONSOR.email,
            })
            .expect(StatusCode.ClientErrorForbidden);
        expect(JSON.parse(response.text)).toHaveProperty("error", "BadCode");

        expect(mockedGenerateJwtToken).not.toBeCalled();
    });

    it("fails to log in with a expired code", async () => {
        await Models.AuthCode.create(EXPIRED_SPONSOR_CODE);
        const response = await post(`/auth/sponsor/login`)
            .send({
                code: SPONSOR_CODE.code,
                email: SPONSOR.email,
            })
            .expect(StatusCode.ClientErrorForbidden);
        expect(JSON.parse(response.text)).toHaveProperty("error", "BadCode");

        expect(mockedGenerateJwtToken).not.toBeCalled();
    });

    it("fails to log in with invalid email", async () => {
        await Models.AuthCode.create(SPONSOR_CODE);
        const response = await post(`/auth/sponsor/login`)
            .send({
                code: SPONSOR_CODE.code,
                email: "bleh@bleh.com",
            })
            .expect(StatusCode.ClientErrorForbidden);
        expect(JSON.parse(response.text)).toHaveProperty("error", "BadCode");

        expect(mockedGenerateJwtToken).not.toBeCalled();
    });
});

describe("GET /auth/roles/list/:role", () => {
    it("provides an error for an non-staff user", async () => {
        const response = await getAsAttendee(`/auth/roles/list/USER`).expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("gets all the users", async () => {
        const response = await getAsStaff(`/auth/roles/list/USER`).expect(StatusCode.SuccessOK);
        const json = JSON.parse(response.text);

        const userIds = [USER.userId, USER_ATTENDEE.userId, USER_STAFF.userId];
        expect(json).toMatchObject({
            userIds: expect.arrayContaining(userIds),
        });
        expect(json?.userIds).toHaveLength(userIds.length);
    });

    it("gets all the attendees", async () => {
        const response = await getAsStaff(`/auth/roles/list/ATTENDEE`).expect(StatusCode.SuccessOK);
        const json = JSON.parse(response.text);

        const userIds = [USER_ATTENDEE.userId, USER_STAFF.userId];
        expect(json).toMatchObject({
            userIds: expect.arrayContaining(userIds),
        });
        expect(json?.userIds).toHaveLength(userIds.length);
    });

    it("gets all the staff", async () => {
        const response = await getAsStaff(`/auth/roles/list/STAFF`).expect(StatusCode.SuccessOK);
        const json = JSON.parse(response.text);

        const userIds = [USER_STAFF.userId];
        expect(json).toMatchObject({
            userIds: expect.arrayContaining(userIds),
        });
        expect(json?.userIds).toHaveLength(userIds.length);
    });
});

describe("GET /auth/roles/list-info/:role", () => {
    it("provides an error for an non-staff user", async () => {
        const response = await getAsAttendee(`/auth/roles/list-info/USER`).expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("gets all user info", async () => {
        const response = await getAsStaff(`/auth/roles/list-info/USER`).expect(StatusCode.SuccessOK);
        const json = JSON.parse(response.text);
        const returnedIds = json.userInfo.map((u: UserInfo) => u.userId);

        const userIds = [USER.userId, USER_ATTENDEE.userId, USER_STAFF.userId];

        expect(returnedIds).toEqual(expect.arrayContaining(userIds));
        expect(returnedIds).toHaveLength(userIds.length);
    });

    it("gets all attendee info", async () => {
        const response = await getAsStaff(`/auth/roles/list-info/ATTENDEE`).expect(StatusCode.SuccessOK);
        const json = JSON.parse(response.text);
        const returnedIds = json.userInfo.map((u: UserInfo) => u.userId);

        const userIds = [USER_ATTENDEE.userId, USER_STAFF.userId];

        expect(returnedIds).toEqual(expect.arrayContaining(userIds));
        expect(returnedIds).toHaveLength(userIds.length);
    });

    it("gets all staff info", async () => {
        const response = await getAsStaff(`/auth/roles/list-info/STAFF`).expect(StatusCode.SuccessOK);
        const json = JSON.parse(response.text);
        const returnedIds = json.userInfo.map((u: UserInfo) => u.userId);

        const userIds = [USER_STAFF.userId];

        expect(returnedIds).toEqual(expect.arrayContaining(userIds));
        expect(returnedIds).toHaveLength(userIds.length);
    });
});

describe("GET /auth/roles/", () => {
    it("gets the roles of a user", async () => {
        await Models.AuthInfo.create({
            userId: TESTER.id,
            provider: "github",
            roles: [Role.USER],
        });
        const response = await getAsUser(`/auth/roles/`).expect(StatusCode.SuccessOK);
        const json = JSON.parse(response.text);

        const roles = [Role.USER];
        expect(json).toMatchObject({
            id: TESTER.id,
            roles: expect.arrayContaining(roles),
        });
        expect(json?.roles).toHaveLength(roles.length);
    });

    it("gets the roles of a attendee", async () => {
        await Models.AuthInfo.create({
            userId: TESTER.id,
            provider: "github",
            roles: [Role.USER, Role.ATTENDEE],
        });
        const response = await getAsAttendee(`/auth/roles/`).expect(StatusCode.SuccessOK);
        const json = JSON.parse(response.text);

        const roles = [Role.USER, Role.ATTENDEE];
        expect(json).toMatchObject({
            id: TESTER.id,
            roles: expect.arrayContaining(roles),
        });
        expect(json?.roles).toHaveLength(roles.length);
    });
});

describe("GET /auth/roles/:id", () => {
    it("provides an error if non-staff", async () => {
        const response = await getAsAttendee(`/auth/roles/${USER_ATTENDEE.userId}`).expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("gets the roles of another user if staff", async () => {
        const response = await getAsStaff(`/auth/roles/${USER_ATTENDEE.userId}`).expect(StatusCode.SuccessOK);
        const json = JSON.parse(response.text);

        const roles = [Role.USER, Role.ATTENDEE];
        expect(json).toMatchObject({
            id: USER_ATTENDEE.userId,
            roles: expect.arrayContaining(roles),
        });
        expect(json?.roles).toHaveLength(roles.length);
    });
});

describe("PUT /auth/roles/:id/:role/", () => {
    it("provides an error if user is not an admin", async () => {
        const response = await putAsStaff(`/auth/roles/${USER.userId}/${Role.ADMIN}/`).expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("adds a role if user is admin", async () => {
        const response = await putAsAdmin(`/auth/roles/${USER.userId}/${Role.ATTENDEE}/`).expect(StatusCode.SuccessOK);
        const json = JSON.parse(response.text);

        const newRoles = [...USER.roles, Role.ATTENDEE];

        expect(json).toMatchObject({
            id: USER.userId,
            roles: expect.arrayContaining(newRoles),
        });
        expect(json?.roles).toHaveLength(newRoles.length);

        const stored = await Models.AuthInfo.findOne({ userId: USER.userId });
        expect(stored).toHaveProperty("roles", expect.arrayContaining(newRoles));
        expect(stored?.roles).toHaveLength(newRoles.length);
    });
});

describe("DELETE /auth/roles/:id/:role/", () => {
    it("provides an error if user is not an admin", async () => {
        const response = await delAsStaff(`/auth/roles/${USER.userId}/${Role.ATTENDEE}/`).expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("removes a role if user is admin", async () => {
        const response = await delAsAdmin(`/auth/roles/${USER.userId}/${Role.USER}/`).expect(StatusCode.SuccessOK);
        const json = JSON.parse(response.text);

        const newRoles: Role[] = [];

        expect(json).toMatchObject({
            id: USER.userId,
            roles: expect.arrayContaining(newRoles),
        });
        expect(json?.roles).toHaveLength(newRoles.length);

        const stored = await Models.AuthInfo.findOne({ userId: USER.userId });
        expect(stored).toHaveProperty("roles", expect.arrayContaining(newRoles));
        expect(stored?.roles).toHaveLength(newRoles.length);
    });
});
