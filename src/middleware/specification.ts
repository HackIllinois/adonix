import { RequestHandler } from "express";
import { AnyZodObject, z } from "zod";
import StatusCode from "status-code-enum";
import { Response, Request, NextFunction } from "express";
import { registerPathSpecification } from "../openapi";
import { RouteConfig } from "@asteasolutions/zod-to-openapi";

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
    VERSION = "Version",
}

export interface ResponseObject {
    description: string;
    schema: AnyZodObject;
}
export interface ResponsesObject {
    [statusCode: string]: ResponseObject;
}

export interface Specification<Params = AnyZodObject, Responses = ResponsesObject, Body = AnyZodObject> {
    path: string;
    method: Method;
    tag: Tag;
    summary: string;
    parameters?: Params;
    body?: Body;
    responses: Responses;
}

// Utility types to convert Responses into a set of possible schemas
type InferResponseBody<T> = T extends ResponseObject ? z.infer<T["schema"]> : never;
type ResponseBody<T extends ResponsesObject> = InferResponseBody<T[keyof T]>;

export default function specification<Params extends AnyZodObject, Responses extends ResponsesObject, Body extends AnyZodObject>(
    spec: Specification<Params, Responses, Body>,
): RequestHandler<z.infer<Params>, ResponseBody<Responses>, z.infer<Body>> {
    registerPathSpecification(spec);

    return async (req: Request, res: Response, next: NextFunction) => {
        if (spec.parameters) {
            const result = await spec.parameters.safeParseAsync(req.params);
            if (!result.success) {
                res.status(StatusCode.ClientErrorBadRequest).json({
                    error: "BadRequest",
                    message: "Bad request made - invalid parameters format",
                    validationErrors: result.error.errors,
                });
            }
        }
        if (spec.body) {
            const result = await spec.body.safeParseAsync(req.body);
            if (!result.success) {
                res.status(StatusCode.ClientErrorBadRequest).json({
                    error: "BadRequest",
                    message: "Bad request made - invalid body format",
                    validationErrors: result.error.errors,
                });
            }
        }
        next();
    };
}
