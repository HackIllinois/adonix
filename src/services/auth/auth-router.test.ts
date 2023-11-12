import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { SpiedFunction } from "jest-mock";
import { RequestHandler } from "express";
import { StatusCode } from "status-code-enum";
import { TESTER, get, getAsUser } from "../../testTools.js";
import Config, { Device } from "../../config.js";
import * as selectAuthMiddleware from "../../middleware/select-auth.js";
import { mockGenerateJwtTokenWithWrapper } from "./auth-lib.test.js";
import { ProfileData } from "./auth-models.js";

const ALL_DEVICES = [Device.WEB, Device.ADMIN, Device.ANDROID, Device.IOS, Device.DEV];

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