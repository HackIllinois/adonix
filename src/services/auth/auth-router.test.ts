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
    putAsAdmin,
    putAsStaff,
} from "../../common/testTools";
import Config, { Device } from "../../common/config";
import * as selectAuthMiddleware from "../../middleware/select-auth";
import { mockGenerateJwtTokenWithWrapper, mockGetJwtPayloadFromProfile } from "../../common/mocks/auth";
import { JwtPayload, ProfileData, Provider, Role } from "./auth-schemas";
import Models from "../../common/models";
import { AuthInfo } from "./auth-schemas";

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
    await Models.AuthInfo.create(USER);
    await Models.AuthInfo.create(USER_ATTENDEE);
    await Models.AuthInfo.create(USER_STAFF);
});

describe("GET /auth/dev/", () => {
    it("returns passed query parameter", async () => {
        const response = await getAsUser("/auth/dev/?token=123").expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({
            Authorization: "123",
        });
    });
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

    it("logs in with default device when none is provided", async () => {
        await get(`/auth/login/${provider}/`).expect(StatusCode.SuccessOK);

        expect(mockedSelectAuthProvider).toBeCalledWith(provider, Config.DEVICE_TO_REDIRECT_URL.get(Config.DEFAULT_DEVICE));
    });

    it.each(ALL_DEVICES)("logs in with provided device %s", async (device) => {
        await get(`/auth/login/${provider}/?device=${device}`).expect(StatusCode.SuccessOK);

        expect(mockedSelectAuthProvider).toBeCalledWith(provider, Config.DEVICE_TO_REDIRECT_URL.get(device));
    });

    it("logs in with provided redirect url", async () => {
        const redirect = "http://localhost:3000/auth/";
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

        const response = await get(`/auth/github/callback/?state=${Config.DEVICE_TO_REDIRECT_URL.get(Device.WEB)}`).expect(
            StatusCode.ClientErrorUnauthorized,
        );

        expect(JSON.parse(response.text)).toHaveProperty("error", "AuthorizationFailed");
    });

    it.each(ALL_DEVICES)("works when authentication passes with device %s", async (device) => {
        const profileData = {
            id: "123",
            email: "test@gmail.com",
        } satisfies ProfileData;
        const provider = Provider.GITHUB;

        // Mock select auth to successfully authenticate & return user data
        mockSelectAuthProvider((req, _res, next) => {
            req.isAuthenticated = ((): boolean => true) as typeof req.isAuthenticated;

            req.user = {
                provider,
                _json: profileData,
            };

            next();
        });

        const response = await get(`/auth/github/callback/?state=${Config.DEVICE_TO_REDIRECT_URL.get(device)}`).expect(
            StatusCode.RedirectFound,
        );

        expect(mockedGenerateJwtToken).toBeCalledWith(
            expect.objectContaining({
                id: `${provider}${profileData.id}`,
                email: profileData.email,
                provider,
                roles: [Role.USER],
            } satisfies JwtPayload),
            false,
        );

        // Expect redirect to be to the right url & contain token
        const jwtReturned = mockedGenerateJwtToken.mock.results[mockedGenerateJwtToken.mock.results.length - 1]!.value;
        expect(response.headers["location"]).toBe(`${Config.DEVICE_TO_REDIRECT_URL.get(device)}?token=${jwtReturned}`);
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

describe("GET /auth/token/refresh", () => {
    it("refreshes the user's token", async () => {
        const generateJwtToken = mockGenerateJwtTokenWithWrapper();
        const getJwtPayloadFromProfile = mockGetJwtPayloadFromProfile();

        const payload = {
            id: TESTER.id,
            email: TESTER.email,
            exp: Math.floor(Date.now() / Config.MILLISECONDS_PER_SECOND),
            provider: "github",
            roles: [Role.USER, Role.ADMIN],
        } satisfies JwtPayload;

        getJwtPayloadFromProfile.mockReturnValue(Promise.resolve(payload));

        const response = await getAsAttendee("/auth/token/refresh").expect(StatusCode.SuccessOK);

        expect(getJwtPayloadFromProfile).toHaveBeenCalledWith(
            payload.provider,
            expect.objectContaining({
                id: payload.id,
                email: payload.email,
            } satisfies ProfileData),
            false,
        );

        expect(generateJwtToken).toHaveBeenCalledWith(payload);

        const jwtReturned = generateJwtToken.mock.results[generateJwtToken.mock.results.length - 1]!.value as string;
        expect(JSON.parse(response.text)).toMatchObject({
            token: jwtReturned,
        });
    });
});
