import { prop } from "@typegoose/typegoose";
import { z } from "zod";
import { CreateErrorAndSchema } from "../../common/schemas";

export class Team {
    @prop({ required: true, unique: true })
    public name: string;
}

export const TeamSchema = z
    .object({
        id: z.string().optional().openapi({ example: "6717efb83b5d4c1a2e47a7e1" }),
        name: z.string().openapi({ example: "Systems" }),
    })
    .openapi("Team", {
        description: "Represents a team within the organization.",
    });

export const [TeamNotFoundError, TeamNotFoundErrorSchema] = CreateErrorAndSchema({
    error: "NotFound",
    message: "Failed to find team",
});
