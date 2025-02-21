import { Request, Response, NextFunction } from "express";
import { StatusCode } from "status-code-enum";
import { tryGetAuthenticatedUser } from "../common/auth";
import { randomUUID } from "crypto";
import { APIError } from "../common/schemas";

function isErrorWithStack(error: unknown): error is { stack: string } {
    return typeof error === "object" && error !== null && "stack" in error;
}

export function ErrorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): Response {
    // Handle pre-defined errors
    if (error instanceof APIError) {
        return res.status(error.status || StatusCode.ServerErrorInternal).send({
            error: error.error,
            message: error.message,
            context: error.context,
        });
    }
    // Handle JSON parsing syntax error
    if (error instanceof SyntaxError) {
        return res.status(StatusCode.ClientErrorBadRequest).send({
            error: "BadRequest",
            message: "Bad request made - unable to parse the request. Are you sending valid JSON?",
        });
    }
    // Handle payload too large error
    if (error && typeof error == "object" && "type" in error && error.type === "entity.too.large") {
        return res.status(StatusCode.ClientErrorPayloadTooLarge).send({
            error: "PayloadTooLarge",
            message: "Your payload is too large. Why are you sending such a large payload?",
        });
    }
    // Otherwise, undefined error - so we display default internal error
    const userId = tryGetAuthenticatedUser(req)?.id || "unauthenticated";
    const id = randomUUID();
    const stack = isErrorWithStack(error) ? `${error.stack}` : undefined;
    const status = StatusCode.ServerErrorInternal;

    console.error(`ERROR ${id} at ${Date.now()} - ${status} ${req.method} ${req.path} ${userId}:\n` + `${stack || error}`);
    return res.status(status).send({
        error: "InternalError",
        message: `Something went wrong - we're looking into it! Id: ${id}`,
        id,
    });
}
