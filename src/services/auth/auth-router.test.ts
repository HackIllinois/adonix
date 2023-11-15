import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { SpiedFunction } from "jest-mock";
import { RequestHandler } from "express";
import { StatusCode } from "status-code-enum";
import { AUTH_ROLE_TO_ROLES, TESTER, get, getAsAttendee, getAsStaff, getAsUser } from "../../testTools.js";
import Config, { Device } from "../../config.js";
import * as selectAuthMiddleware from "../../middleware/select-auth.js";
import { mockGenerateJwtTokenWithWrapper } from "./auth-lib.test.js";
import { ProfileData, Role } from "./auth-models.js";
import Models from "../../database/models.js";
import { AuthInfo } from "../../database/auth-db.js";

const ALL_DEVICES = [Device.WEB, Device.ADMIN, Device.ANDROID, Device.IOS, Device.DEV];

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

beforeEach(async () => {
    Models.initialize();
    await Models.AuthInfo.create(USER);
    await Models.AuthInfo.create(USER_ATTENDEE);
    await Models.AuthInfo.create(USER_STAFF);
});

describe("GET /auth/dev/", () => {
    it("errors when a token is not provided", async () => {
        const response = await getAsUser("/auth/dev/").expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NoToken");
    });

    it("returns passed query parameter", async () => {
        const response = await getAsUser("/auth/dev/?token=123").expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({
            token: "123",
        });
    });
});

/*
 * Mocks generateJwtToken with a wrapper so calls and returns can be examined. Does not change behavior.
 */
function mockSelectAuthProvider(handler: RequestHandler): SpiedFunction<typeof selectAuthMiddleware.SelectAuthProvider> {
    const mockedSelectAuthMiddleware = require("../../middleware/select-auth.js") as typeof selectAuthMiddleware;
    const mockedSelectAuthProvider = jest.spyOn(mockedSelectAuthMiddleware, "SelectAuthProvider");
    mockedSelectAuthProvider.mockImplementation(() => {
        return handler;
    });
    return mockedSelectAuthProvider;
}

describe.each(["github", "google"])("GET /auth/login/%s/", (provider) => {
    let mockedSelectAuthProvider: SpiedFunction<typeof selectAuthMiddleware.SelectAuthProvider>;

    beforeEach(() => {
        mockedSelectAuthProvider = mockSelectAuthProvider((_req, res, _next) => {
            res.status(StatusCode.SuccessOK).send();
        });
    });

    it("provides an error when no device is provided", async () => {
        const response = await get(`/auth/login/${provider}/?device=abc`).expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "BadDevice");
    });

    it("logs in with default device when none is provided", async () => {
        await get(`/auth/login/${provider}/`).expect(StatusCode.SuccessOK);

        expect(mockedSelectAuthProvider).toBeCalledWith(provider, Config.DEFAULT_DEVICE);
    });

    it.each(ALL_DEVICES)("logs in with provided device %s", async (device) => {
        await get(`/auth/login/${provider}/?device=${device}`).expect(StatusCode.SuccessOK);

        expect(mockedSelectAuthProvider).toBeCalledWith(provider, device);
    });
});

describe("GET /auth/:PROVIDER/callback/:DEVICE", () => {
    let mockedGenerateJwtToken: ReturnType<typeof mockGenerateJwtTokenWithWrapper>;

    beforeEach(() => {
        mockSelectAuthProvider((_req, _res, _next) => {
            console.error("Select auth provider called when it shouldn't be!");
        });
        mockedGenerateJwtToken = mockGenerateJwtTokenWithWrapper();
    });

    it("provides an error when an invalid device is provided", async () => {
        const response = await get("/auth/github/callback/abc").expect(StatusCode.ServerErrorInternal);

        expect(JSON.parse(response.text)).toHaveProperty("error", "InternalServerError");
    });

    it("provides an error when authentication fails", async () => {
        // Mock select auth to return not authenticated
        mockSelectAuthProvider((req, _res, next) => {
            req.isAuthenticated = (): boolean => {
                return false;
            };

            next();
        });

        const response = await get(`/auth/github/callback/${Device.WEB}`).expect(StatusCode.ClientErrorUnauthorized);

        expect(JSON.parse(response.text)).toHaveProperty("error", "FailedAuth");
    });

    it("provides an error when invalid data is provided", async () => {
        // Mock select auth to successfully authenticate & return invalid user data
        mockSelectAuthProvider((req, _res, next) => {
            req.isAuthenticated = (): boolean => {
                return true;
            };

            req.user = {
                // no content
            };

            next();
        });

        const response = await get(`/auth/github/callback/${Device.WEB}`).expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "InvalidData");
    });

    it.each(ALL_DEVICES)("works when authentication passes with device %s", async (device) => {
        // Mock select auth to successfully authenticate & return user data
        mockSelectAuthProvider((req, _res, next) => {
            req.isAuthenticated = (): boolean => {
                return true;
            };

            req.user = {
                provider: "github",
                _json: {
                    id: `github123`,
                    email: TESTER.email,
                } satisfies ProfileData,
            };

            next();
        });

        const response = await get(`/auth/github/callback/${device}`).expect(StatusCode.RedirectFound);

        // Expect redirect to be to the right url & contain token
        const jwtReturned = mockedGenerateJwtToken.mock.results[mockedGenerateJwtToken.mock.results.length - 1]!.value;
        expect(response.headers["location"]).toBe(`${Config.REDIRECT_URLS.get(device)}?token=${jwtReturned}`);
    });
});

describe("GET /auth/roles/list/:ROLE", () => {
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

describe("GET /auth/roles/", () => {
    it("provides an error if the user does not have auth info", async () => {
        const response = await getAsUser(`/auth/roles/`).expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "UserNotFound");
    });

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

describe("GET /auth/roles/:USERID", () => {
    it("provides an error if the user does not have auth info", async () => {
        const response = await getAsStaff(`/auth/roles/123`).expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "UserNotFound");
    });

    it("provides an error if non-staff user tries to get roles of another user", async () => {
        const response = await getAsAttendee(`/auth/roles/${USER_ATTENDEE.userId}`).expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("gets the roles of themselves if non-staff", async () => {
        const response = await getAsAttendee(`/auth/roles/${TESTER.id}`).expect(StatusCode.SuccessOK);
        const json = JSON.parse(response.text);

        const roles = AUTH_ROLE_TO_ROLES[Role.ATTENDEE];
        expect(json).toMatchObject({
            id: TESTER.id,
            roles: expect.arrayContaining(roles),
        });
        expect(json?.roles).toHaveLength(roles.length);
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
