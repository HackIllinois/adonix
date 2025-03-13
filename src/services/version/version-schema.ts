import { z } from "zod";

export const VersionSchema = z.string().openapi({ description: "The version", example: "2024.2.4" });

export const VersionResponseSchema = z
    .object({
        version: VersionSchema,
    })
    .openapi("VersionResponse");
