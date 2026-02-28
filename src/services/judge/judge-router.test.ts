import { describe, expect, it } from "@jest/globals";
import { StatusCode } from "status-code-enum";
import Models from "../../common/models";
import { delAsAdmin, delAsAttendee, getAsAttendee, postAsAdmin, postAsAttendee, putAsAdmin } from "../../common/testTools";

const TESTER_JUDGE_1 = {
    name: "Ada Lovelace",
    description: "Can judge technical architecture and product strategy.",
    imageUrl:
        "https://raw.githubusercontent.com/HackIllinois/hackillinois/main/mobile/assets/profile/avatar-screen/avatars/character1.svg",
};

const TESTER_JUDGE_2 = {
    name: "Grace Hopper",
    description: "Can judge systems design and engineering execution.",
    imageUrl:
        "https://raw.githubusercontent.com/HackIllinois/hackillinois/main/mobile/assets/profile/avatar-screen/avatars/character2.svg",
};

describe("POST /judge/info", () => {
    it("gives an invalid perms error for a non-staff user", async () => {
        const response = await postAsAttendee(`/judge/info/`)
            .send({
                name: "Judge Name",
                description: "Test description",
            })
            .expect(StatusCode.ClientErrorForbidden);

        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("works for staff", async () => {
        const response = await postAsAdmin(`/judge/info/`)
            .send({
                name: "Judge Name",
                description: "I evaluate product and technical quality.",
                imageUrl:
                    "https://raw.githubusercontent.com/HackIllinois/hackillinois/main/mobile/assets/profile/avatar-screen/avatars/character3.svg",
            })
            .expect(StatusCode.SuccessCreated);

        const body = JSON.parse(response.text);
        expect(body).toHaveProperty("_id");
        expect(body).toHaveProperty("name", "Judge Name");
        expect(body).toHaveProperty("description", "I evaluate product and technical quality.");
        expect(body).toHaveProperty(
            "imageUrl",
            "https://raw.githubusercontent.com/HackIllinois/hackillinois/main/mobile/assets/profile/avatar-screen/avatars/character3.svg",
        );
    });
});

describe("GET /judge/info", () => {
    it("works for attendees and sorts judges by name", async () => {
        await Models.JudgeProfile.create(TESTER_JUDGE_2);
        await Models.JudgeProfile.create(TESTER_JUDGE_1);

        const response = await getAsAttendee(`/judge/info/`).expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject([TESTER_JUDGE_1, TESTER_JUDGE_2]);
    });
});

describe("PUT /judge/info/id/", () => {
    it("gives a not found error for a nonexistent judge", async () => {
        const response = await putAsAdmin(`/judge/info/65f0d1d7f6201f6a63dbf53f/`)
            .send({
                name: "Updated Name",
                description: "Updated description",
            })
            .expect(StatusCode.ClientErrorNotFound);

        expect(JSON.parse(response.text)).toHaveProperty("error", "NotFound");
    });

    it("works for staff", async () => {
        const createdJudge = await Models.JudgeProfile.create(TESTER_JUDGE_1);

        const response = await putAsAdmin(`/judge/info/${createdJudge._id.toString()}/`)
            .send({
                name: "Ada",
                description: "Updated bio",
                imageUrl:
                    "https://raw.githubusercontent.com/HackIllinois/hackillinois/main/mobile/assets/profile/avatar-screen/avatars/character4.svg",
            })
            .expect(StatusCode.SuccessOK);

        expect(JSON.parse(response.text)).toMatchObject({
            _id: createdJudge._id.toString(),
            name: "Ada",
            description: "Updated bio",
            imageUrl:
                "https://raw.githubusercontent.com/HackIllinois/hackillinois/main/mobile/assets/profile/avatar-screen/avatars/character4.svg",
        });
    });
});

describe("DELETE /judge/info/id/", () => {
    it("gives an invalid perms error for a non-staff user", async () => {
        const createdJudge = await Models.JudgeProfile.create(TESTER_JUDGE_1);
        const response = await delAsAttendee(`/judge/info/${createdJudge._id.toString()}/`).expect(
            StatusCode.ClientErrorForbidden,
        );
        expect(JSON.parse(response.text)).toHaveProperty("error", "Forbidden");
    });

    it("gives a not found error for a nonexistent judge", async () => {
        const response = await delAsAdmin(`/judge/info/65f0d1d7f6201f6a63dbf53f/`).expect(StatusCode.ClientErrorNotFound);
        expect(JSON.parse(response.text)).toHaveProperty("error", "NotFound");
    });

    it("works for staff", async () => {
        const createdJudge = await Models.JudgeProfile.create(TESTER_JUDGE_1);
        await delAsAdmin(`/judge/info/${createdJudge._id.toString()}/`).expect(StatusCode.SuccessOK);

        const judgeProfile = await Models.JudgeProfile.findById(createdJudge._id.toString());
        expect(judgeProfile).toBeNull();
    });
});
