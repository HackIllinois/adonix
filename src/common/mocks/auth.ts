import { SpiedFunction } from "jest-mock";
import { jest } from "@jest/globals";
import * as authLib from "../auth";

/*
 * Mocks generateJwtToken with a wrapper so calls and returns can be examined. Does not change behavior.
 */
export function mockGenerateJwtTokenWithWrapper(): SpiedFunction<typeof authLib.generateJwtToken> {
    const mockedAuthLib = require("../auth") as typeof authLib;
    const mockedGenerateJwtToken = jest.spyOn(mockedAuthLib, "generateJwtToken");
    mockedGenerateJwtToken.mockImplementation((payload, shouldNotExpire, expiration) =>
        authLib.generateJwtToken(payload, shouldNotExpire, expiration),
    );
    return mockedGenerateJwtToken;
}

/*
 * Mocks getJwtPayloadFromProfile, returns SpiedFunction.
 * Note: You must actually mock the implementation, this method just returns a Spy to mock!
 */
export function mockGetJwtPayloadFromProfile(): SpiedFunction<typeof authLib.getJwtPayloadFromProfile> {
    const mockedAuthLib = require("../auth") as typeof authLib;
    return jest.spyOn(mockedAuthLib, "getJwtPayloadFromProfile");
}
