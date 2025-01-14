// A few sanity tests to make sure the app is running properly

import { describe, expect, test, it } from "@jest/globals";

import { get } from "./common/testTools";
import { StatusCode } from "status-code-enum";
import Config from "./common/config";

const EXPECTED_STATUS = {
    ok: true,
    version: Config.VERSION,
    info: "Welcome to HackIllinois' backend API!",
    docs: expect.stringMatching(/\/docs\/$/),
};

describe("sanity tests for app", () => {
    test("life is not a lie", () => {
        expect(7 * 6).toBe(42);
    });

    it("should run", async () => {
        const response = await get("/").expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject(EXPECTED_STATUS);
    });

    it("should have a good status", async () => {
        const response = await get("/status/").expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject(EXPECTED_STATUS);
    });

    it("should generate valid API specification", async () => {
        await get("/docs/").expect(StatusCode.SuccessOK);
        const response = await get("/docs/json/").expect(StatusCode.SuccessOK);
        const parsed = JSON.parse(response.text);

        expect(parsed).toMatchObject({
            info: expect.objectContaining({
                title: "adonix",
            }),
            paths: expect.objectContaining({}),
            components: expect.objectContaining({}),
        });
        expect(Object.keys((parsed as { paths: Record<string, unknown> }).paths)).not.toHaveLength(0);
        expect(Object.keys((parsed as { components: Record<string, unknown> }).components)).not.toHaveLength(0);
    });
});
