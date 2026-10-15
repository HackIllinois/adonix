import { describe, it, expect } from "@jest/globals";

import Models from "../../common/models";
import { ensureSeedUsers } from "./dev-lib";

describe("ensureSeedUsers", () => {
    it("seeds a few users when the database is empty", async () => {
        const users = await ensureSeedUsers();

        expect(users.map((entry) => entry.user.userId)).toEqual(["githubseed0001", "githubseed0002", "githubseed0003"]);
    });

    it("skips existing users and leaves their downstream data alone", async () => {
        await Models.UserInfo.create({
            userId: "githubseed0001",
            name: "Existing Dev",
            email: "githubseed0001@example.com",
        });
        await Models.RegistrationApplicationDraft.create({ userId: "githubseed0001", firstName: "KeepMe" });

        await ensureSeedUsers();

        expect(await Models.RegistrationApplicationDraft.findOne({ userId: "githubseed0001" })).not.toBeNull();
        expect(await Models.UserInfo.countDocuments({ userId: /^githubseed/ })).toBe(3);
    });

    it("is a no-op on the second run", async () => {
        await ensureSeedUsers();
        await ensureSeedUsers();

        expect(await Models.UserInfo.countDocuments({ userId: /^githubseed/ })).toBe(3);
    });
});
