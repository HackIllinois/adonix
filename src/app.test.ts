// A few sanity tests to make sure the app is running properly

import { describe, expect, test, it } from "@jest/globals";

import { get } from "./testTools.js";
import { StatusCode } from "status-code-enum";

describe("sanity tests for app", () => {
    test("life is not a lie", () => {
        expect(7 * 6).toBe(42);
    });

    it("should run", async () => {
        const response = await get("/").expect(StatusCode.SuccessOK);

        expect(response.text).toBe("API is working!!!");
    });
});
