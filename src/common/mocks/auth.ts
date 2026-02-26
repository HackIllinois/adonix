import { SpiedFunction } from "jest-mock";
import { jest } from "@jest/globals";
import * as authLib from "../auth";

/*
 * Mocks generateJwtToken with a wrapper so calls and returns can be examined. Does not change behavior.
 * jest.spyOn calls through to the original by default.
 */
export function mockGenerateJwtTokenWithWrapper(): SpiedFunction<typeof authLib.generateJwtToken> {
    return jest.spyOn(authLib, "generateJwtToken");
}

/*
 * Mocks getJwtPayloadFromProfile, returns SpiedFunction.
 * Note: You must actually mock the implementation, this method just returns a Spy to mock!
 */
export function mockGetJwtPayloadFromProfile(): SpiedFunction<typeof authLib.getJwtPayloadFromProfile> {
    return jest.spyOn(authLib, "getJwtPayloadFromProfile");
}
