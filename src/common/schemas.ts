import { z } from "zod";

export const SuccessResponseSchema = z.object({
    success: z.literal(true),
});

export const UserIdSchema = z.string().openapi("UserId", {
    description: "Id of a specific user. Can start with github or google.",
    example: "github1234",
});

export const EventIdSchema = z.string().openapi("EventId", { example: "event1" });

export class APIError<TError, TMessage> {
    constructor(
        public error: TError,
        public message: TMessage,
        public status?: number,
        public context?: unknown,
    ) {}
}

interface ErrorParams<TError, TMessage> {
    error: TError;
    message: TMessage;
}

export function CreateErrorSchema<TError extends string, TMessage extends string>(
    params: ErrorParams<TError, TMessage>,
): z.ZodObject<{
    error: z.ZodLiteral<TError>;
    message: z.ZodLiteral<TMessage>;
}> {
    // Zod schema definition, keeping the literal types for error and message
    const { error, message } = params;
    return z
        .object({
            error: z.literal(error),
            message: z.literal(message),
        })
        .openapi({
            example: {
                error,
                message,
                // The types for this are super complicated but this is always true
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
        });
}

/**
 * Creates a error object and schema zod given a error type and message
 * @param params the error type and message
 * @returns an array of the error object and schema - [ErrorObject, ZodSchema]
 * @example
 * const [SomeError, SomeErrorSchema] = CreateErrorAndSchema({
 *     error: "SomeError",
 *     message: "Some detailed description of some error"
 * })
 */
export function CreateErrorAndSchema<TError extends string, TMessage extends string>(
    params: ErrorParams<TError, TMessage>,
): [
    APIError<TError, TMessage>,
    z.ZodObject<{
        error: z.ZodLiteral<TError>;
        message: z.ZodLiteral<TMessage>;
    }>,
] {
    const { error, message } = params;
    // Return the tuple with literal types preserved
    return [new APIError(error, message), CreateErrorSchema(params)] as const;
}
