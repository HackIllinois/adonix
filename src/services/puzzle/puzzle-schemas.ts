import { prop } from "@typegoose/typegoose";
import { z } from "zod";
import { UserIdSchema } from "../../common/schemas";
import { CreateErrorAndSchema } from "../../common/schemas";

export class PuzzleItem {
    @prop({ required: true })
    public userId: string;

    @prop({ required: true })
    public teamName: string;

    @prop({ required: true })
    public lastCorrect: number;

    @prop({ required: true })
    public score: number;

    @prop({
        required: true,
        type: () => Boolean,
    })
    public problemComplete: boolean[];

    constructor(userId: string, teamName: string, lastCorrect: number, score: number, problemComplete: boolean[]) {
        this.userId = userId;
        this.teamName = teamName;
        this.lastCorrect = lastCorrect;
        this.problemComplete = problemComplete;
        this.score = score;
    }
}

export class PuzzleAnswer {
    @prop({ required: true })
    public qid: number;

    @prop({ required: true })
    public answer: string;
}

export const PuzzleQuestionIdSchema = z.string().openapi({ example: "1" });
export const PuzzleTeamNameSchema = z.string().openapi({ example: "team team" });

export const PuzzleSchema = z.object({
    userId: UserIdSchema,
    teamName: PuzzleTeamNameSchema,
    lastCorrect: z.number().openapi({ example: 123 }),
    score: z.number().openapi({ example: 3 }),
    problemComplete: z.array(z.boolean()).openapi({ example: [true, true, false] }),
});

export const PuzzleAnswerRequestSchema = z.object({
    answer: z.string().openapi({ example: "tacocat" }),
});

export const PuzzleCreateRequestSchema = z.object({
    teamName: PuzzleTeamNameSchema,
});

export const [PuzzleNotCreatedError, PuzzleNotCreatedErrorSchema] = CreateErrorAndSchema({
    error: "NotCreated",
    message: "You need to create a puzzle first!",
});

export const [PuzzleQuestionNotFoundError, PuzzleQuestionNotFoundErrorSchema] = CreateErrorAndSchema({
    error: "NotFound",
    message: "That question doesn't exist!",
});

export const [PuzzleIncorrectAnswerError, PuzzleIncorrectAnswerErrorSchema] = CreateErrorAndSchema({
    error: "IncorrectAnswer",
    message: "Your answer was incorrect!",
});
