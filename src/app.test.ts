// A few sanity tests to make sure the app is running properly

import { describe, expect, test, it } from "@jest/globals";

import { get } from "./testTools";
import { StatusCode } from "status-code-enum";

describe("sanity tests for app", () => {
    test("life is not a lie", () => {
        expect(7 * 6).toBe(42);
    });

    it("should run", async () => {
        const response = await get("/").expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({
            ok: true,
            info: "Welcome to HackIllinois' backend API!",
            docs: expect.stringMatching(/\/docs\/$/),
        });
    });

    it("should generate valid API specification", async () => {
        await get("/docs/").expect(StatusCode.SuccessOK);
        const response = await get("/docs/json/").expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toHaveProperty(
            "info",
            expect.objectContaining({
                title: "adonix",
            }),
        );
    });
});
