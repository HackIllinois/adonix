import { describe, it, expect } from "@jest/globals";
import { StatusCode } from "status-code-enum";
import { getAsUser } from "../../testTools.js";

describe("GET /auth/dev/", () => {
    it("fails when token is not provided", async () => {
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
