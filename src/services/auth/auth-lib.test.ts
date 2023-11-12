import { describe, it, expect, jest } from "@jest/globals";
import { SpiedFunction } from "jest-mock";
import * as authLib from "../auth/auth-lib.js";

/*
 * Mocks generateJwtToken with a wrapper so calls and returns can be examined. Does not change behavior.
 */
export function mockGenerateJwtTokenWithWrapper(): SpiedFunction<typeof authLib.generateJwtToken> {
    const mockedAuthLib = require("../auth/auth-lib.js") as typeof authLib;
    const mockedGenerateJwtToken = jest.spyOn(mockedAuthLib, "generateJwtToken");
    mockedGenerateJwtToken.mockImplementation((payload, shouldNotExpire, expiration) => {
        return authLib.generateJwtToken(payload, shouldNotExpire, expiration);
    });
    return mockedGenerateJwtToken;
}

/* Temporary test to appease the jest gods */
describe("Todo", () => {
    it("works", () => {
        expect(1 + 1).toBe(2);
    });
});