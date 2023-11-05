import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { SpiedFunction } from "jest-mock";
import { StatusCode } from "status-code-enum";
import { get, getAsUser } from "../../testTools.js";
import Config, { Device } from "../../config.js";
import * as selectAuthMiddleware from "../../middleware/select-auth.js";

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
function mockSelectAuthProvider(): SpiedFunction<typeof selectAuthMiddleware.SelectAuthProvider> {
    const mockedSelectAuthMiddleware = require("../../middleware/select-auth.js") as typeof selectAuthMiddleware;
    const mockedSelectAuthProvider = jest.spyOn(mockedSelectAuthMiddleware, "SelectAuthProvider");
    mockedSelectAuthProvider.mockImplementation(() => {
        return (_req, res, _next) => {
            res.status(StatusCode.SuccessOK).send();
        };
    });
    return mockedSelectAuthProvider;
}

describe.each(["github", "google"])("GET /auth/login/%s/", (provider) => {
    let mockedSelectAuthProvider: SpiedFunction<typeof selectAuthMiddleware.SelectAuthProvider>;

    beforeEach(() => {
        mockedSelectAuthProvider = mockSelectAuthProvider();
    });

    it("provides an error when no device is provided", async () => {
        const response = await get(`/auth/login/${provider}/?device=abc`).expect(StatusCode.ClientErrorBadRequest);

        expect(JSON.parse(response.text)).toHaveProperty("error", "BadDevice");
    });

    it("logs in with default device when none is provided", async () => {
        await get(`/auth/login/${provider}/`).expect(StatusCode.SuccessOK);

        expect(mockedSelectAuthProvider).toBeCalledWith(provider, Config.DEFAULT_DEVICE);
    });

    it.each([Device.WEB, Device.ADMIN, Device.ANDROID, Device.IOS, Device.DEV])(
        "logs in with provided device %s",
        async (device) => {
            await get(`/auth/login/${provider}/?device=${device}`).expect(StatusCode.SuccessOK);

            expect(mockedSelectAuthProvider).toBeCalledWith(provider, device);
        },
    );
});
