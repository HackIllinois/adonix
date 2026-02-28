import { prop } from "@typegoose/typegoose";
import { z } from "zod";
import { CreateErrorAndSchema } from "../../common/schemas";

export const DEFAULT_JUDGE_IMAGE_URL =
    "https://raw.githubusercontent.com/HackIllinois/hackillinois/main/mobile/assets/profile/avatar-screen/avatars/character1.svg";

export class JudgeProfile {
    @prop({ required: true })
    public name: string;

    @prop({ required: true })
    public description: string;

    @prop({ required: true, default: DEFAULT_JUDGE_IMAGE_URL })
    public imageUrl: string;
}

export const JudgeMongoIdSchema = z
    .string()
    .regex(/^[a-fA-F0-9]{24}$/)
    .openapi("JudgeMongoId", { example: "65f0d1d7f6201f6a63dbf53e" });

export const JudgeProfileCreateRequestSchema = z
    .object({
        name: z.string().openapi({ example: "Ada Lovelace" }),
        description: z.string().openapi({ example: "Can judge product, technical depth, and storytelling." }),
        imageUrl: z.string().url().optional().default(DEFAULT_JUDGE_IMAGE_URL).openapi({
            example: DEFAULT_JUDGE_IMAGE_URL,
            description: "Public URL for the judge profile image bytes",
        }),
    })
    .openapi("JudgeProfileCreateRequest");

export const JudgeProfileSchema = JudgeProfileCreateRequestSchema.extend({
    _id: JudgeMongoIdSchema,
}).openapi("JudgeProfile");

export const [JudgeNotFoundError, JudgeNotFoundErrorSchema] = CreateErrorAndSchema({
    error: "NotFound",
    message: "Failed to find judge",
});
