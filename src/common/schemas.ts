import { z } from "zod";

export const SuccessResponseSchema = z.object({
    success: z.literal(true),
});

export const UserIdSchema = z.string().openapi("UserId", {
    description: "Id of a specific user. Can start with github or google.",
    example: "github1234",
});

export const EventIdSchema = z.string().openapi("EventId", { example: "event1" });

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
export function CreateErrorAndSchema<TError extends string, TMessage extends string>(params: {
    error: TError;
    message: TMessage;
}): [
    { readonly error: TError; readonly message: TMessage },
    z.ZodObject<{
        error: z.ZodLiteral<TError>;
        message: z.ZodLiteral<TMessage>;
    }>,
] {
    const { error, message } = params;
    // Zod schema definition, keeping the literal types for error and message
    const schema = z
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

    // Error object, again preserving the literal types
    const errorObj = {
        error,
        message,
    } as const; // Ensure the object literal types are retained

    return [errorObj, schema] as const; // Return the tuple with literal types preserved
}
