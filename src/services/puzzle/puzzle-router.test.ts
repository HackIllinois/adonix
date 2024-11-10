import { describe, expect, it } from "@jest/globals"; // , jest
import { StatusCode } from "status-code-enum";
import Models from "../../common/models";
import { getAsUser, post, postAsUser } from "../../common/testTools"; //  TESTER, getAsAdmin, postAsUser
import { PuzzleAnswer, PuzzleItem } from "./puzzle-schemas";

const TESTER_PUZZLE_ITEM = {
    userId: "bob-the-tester101010101011",
    lastCorrect: 1708812000,
    problemComplete: [false, false, false, false, false, false, false, false, false, false],
    score: 0,
    teamName: "tester team 1",
} satisfies PuzzleItem;

const TESTER_CREATED_PUZZLE_ITEM = {
    userId: "bob-the-tester101010101011",
    problemComplete: [false, false, false, false, false, false, false, false, false, false],
    score: 0,
    teamName: "tester team 1",
};

const UPDATED_TESTER_PUZZLE_ITEM = {
    userId: "bob-the-tester101010101011",
    problemComplete: [false, true, false, false, false, false, false, false, false, false],
    score: 1,
    teamName: "tester team 1",
};

const TESTER_PUZZLE_ANSWER = {
    qid: 1,
    answer: "correct_answer",
} satisfies PuzzleAnswer;

describe("GET /status/", () => {
    it("works for registered user", async () => {
        await Models.PuzzleItem.create(TESTER_PUZZLE_ITEM);
        const response = await getAsUser("/puzzle/status/").expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject(TESTER_PUZZLE_ITEM);
    });

    it("gives not found error for unregistered user", async () => {
        await getAsUser("/puzzle/status/").expect(StatusCode.ClientErrorNotFound);
    });
});

describe("POST /submit/:qid/", () => {
    it("works for registered user, correct answer", async () => {
        await Models.PuzzleItem.create(TESTER_PUZZLE_ITEM);
        await Models.PuzzleAnswer.create(TESTER_PUZZLE_ANSWER);
        const response = await postAsUser("/puzzle/submit/1/").send({ answer: "correct_answer" }).expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject(UPDATED_TESTER_PUZZLE_ITEM);
    });

    it("returns bad request error for registered user, incorrect answer", async () => {
        await Models.PuzzleItem.create(TESTER_PUZZLE_ITEM);
        await Models.PuzzleAnswer.create(TESTER_PUZZLE_ANSWER);
        const response = await postAsUser("/puzzle/submit/1/")
            .send({ answer: "incorrect_answer" })
            .expect(StatusCode.ClientErrorBadRequest);
        expect(JSON.parse(response.text)).toHaveProperty("message", "Your answer was incorrect!");
    });

    it("returns not found error for registered user, nonexistent question", async () => {
        await Models.PuzzleItem.create(TESTER_PUZZLE_ITEM);
        const response = await postAsUser("/puzzle/submit/33/")
            .send({ answer: "filler_answer" })
            .expect(StatusCode.ClientErrorNotFound);
        expect(JSON.parse(response.text)).toHaveProperty("message", "That question doesn't exist!");
    });

    it("returns not found error for unregistered user", async () => {
        const response = await postAsUser("/puzzle/submit/1")
            .send({ answer: "filler_answer" })
            .expect(StatusCode.ClientErrorNotFound);
        expect(JSON.parse(response.text)).toHaveProperty("message", "That question doesn't exist!");
    });
});

describe("POST /puzzle/create/", () => {
    it("creates a new puzzle for authenticated user", async () => {
        const response = await postAsUser("/puzzle/create/").send({ teamName: "tester team 1" }).expect(StatusCode.SuccessOK);
        expect(JSON.parse(response.text)).toMatchObject(TESTER_CREATED_PUZZLE_ITEM);
    });

    it("returns unauthorized error for unauthenticated user", async () => {
        const response = await post("/puzzle/create/", undefined)
            .send({ teamName: "tester team 1" })
            .expect(StatusCode.ClientErrorUnauthorized);
        expect(JSON.parse(response.text)).toHaveProperty("message", "A authorization token must be sent for this request");
    });

    it("returns validation error for missing team name", async () => {
        const response = await postAsUser("/puzzle/create/").expect(StatusCode.ClientErrorBadRequest);
        expect(response.text).toContain("invalid_type in body.teamName: Required");
    });
});
