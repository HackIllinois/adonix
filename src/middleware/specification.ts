import { RequestHandler } from "express";
import { AnyZodObject, z, ZodObject, ZodType, ZodUnknown } from "zod";
import StatusCode from "status-code-enum";
import { Response, Request, NextFunction } from "express";
import { registerPathSpecification } from "../common/openapi";
import { RouteConfig } from "@asteasolutions/zod-to-openapi";
import { Role } from "../services/auth/auth-schemas";
import { getAuthenticatedUser } from "../common/auth";
import { TokenExpiredError } from "jsonwebtoken";

export type Method = RouteConfig["method"];

export enum Tag {
    ADMISSION = "Admission",
    AUTH = "Auth",
    EVENT = "Event",
    MAIL = "Mail",
    MENTOR = "Mentor",
    NEWSLETTER = "Newsletter",
    NOTIFICATION = "Notification",
    PROFILE = "Profile",
    PUZZLE = "Puzzle",
    REGISTRATION = "Registration",
    S3 = "S3",
    SHOP = "Shop",
    STAFF = "Staff",
    USER = "User",
    VERSION = "Version",
}

export interface ResponseObject {
    description: string;
    schema: ZodType;
}
export interface ResponsesObject {
    [statusCode: string]: ResponseObject;
}

export interface Specification<Params = ZodUnknown, Query = ZodUnknown, Responses = ResponsesObject, Body = ZodUnknown> {
    path: string;
    method: Method;
    tag: Tag;
    role: Role | null;
    summary: string;
    description?: string;
    parameters?: Params;
    query?: Query;
    body?: Body;
    responses: Responses;
}

// Utility types to convert Responses into a set of possible schemas
type InferResponseBody<T> = T extends ResponseObject ? z.infer<T["schema"]> : never;
type ResponseBody<T extends ResponsesObject> = InferResponseBody<T[keyof T]>;

// Utility type for a zod object which is really just empty
type ZodEmptyObject = ZodObject<NonNullable<unknown>>;

export default function specification<
    Responses extends ResponsesObject,
    Params extends AnyZodObject = ZodEmptyObject,
    Query extends AnyZodObject = ZodEmptyObject,
    Body extends ZodType = ZodUnknown,
>(
    spec: Specification<Params, Query, Responses, Body>,
): RequestHandler<z.infer<Params>, ResponseBody<Responses>, z.infer<Body>, z.infer<Query>> {
    registerPathSpecification(spec);

    return async (req: Request, res: Response, next: NextFunction) => {
        if (spec.role) {
            try {
                const jwt = getAuthenticatedUser(req);
                if (!jwt.roles.includes(spec.role)) {
                    return res.status(StatusCode.ClientErrorForbidden).json({
                        error: "Forbidden",
                        message: `You require the role ${spec.role} to do that`,
                    });
                }
            } catch (error) {
                if (error instanceof TokenExpiredError) {
                    return res.status(StatusCode.ClientErrorForbidden).json({
                        error: "TokenExpired",
                        message: "Your session has expired, please log in again",
                    });
                } else if (error instanceof Error && error.message == "NoToken") {
                    return res.status(StatusCode.ClientErrorUnauthorized).send({
                        error: "NoToken",
                        message: "A authorization token must be sent for this request",
                    });
                } else {
                    return res.status(StatusCode.ClientErrorUnauthorized).send({
                        error: "TokenInvalid",
                        message: "Your session is invalid, please log in again",
                    });
                }
            }
        }

        if (spec.parameters) {
            const result = await spec.parameters.safeParseAsync(req.params);
            if (!result.success) {
                return res.status(StatusCode.ClientErrorBadRequest).json({
                    error: "BadRequest",
                    message: "Bad request made - invalid parameters format",
                    validationErrors: result.error.errors,
                });
            }
        }

        if (spec.query) {
            const result = await spec.query.safeParseAsync(req.query);
            if (!result.success) {
                return res.status(StatusCode.ClientErrorBadRequest).json({
                    error: "BadRequest",
                    message: "Bad request made - invalid query format",
                    validationErrors: result.error.errors,
                });
            }
        }

        if (spec.body) {
            const result = await spec.body.safeParseAsync(req.body);
            if (!result.success) {
                return res.status(StatusCode.ClientErrorBadRequest).json({
                    error: "BadRequest",
                    message: "Bad request made - invalid body format",
                    validationErrors: result.error.errors,
                });
            }
        }
        return next();
    };
}
