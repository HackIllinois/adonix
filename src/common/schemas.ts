import { z } from "zod";

export const SuccessResponseSchema = z.object({
    success: z.literal(true),
});
