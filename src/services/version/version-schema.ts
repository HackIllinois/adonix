import { z } from "zod";

export const versionResponseSchema = z
    .object({
        version: z.string().openapi({ description: "The version", example: "2024.2.4" }),
    })
    .openapi("VersionResponse");
