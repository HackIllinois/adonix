import { RequestHandler } from "express";
import { AnyZodObject, z, ZodObject, ZodType, ZodUnknown } from "zod";
import { registerPathSpecification } from "../common/openapi";
import { RouteConfig } from "@asteasolutions/zod-to-openapi";
import { Role } from "../services/auth/auth-schemas";
import { specificationValidator } from "./specification-validator";

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
    RESUME = "Resume",
    SHOP = "Shop",
    STAFF = "Staff",
    STATISTIC = "Statistic",
    USER = "User",
    VERSION = "Version",
    SPONSOR = "Sponsor",
}

export interface ResponseObject {
    description: string;
    schema: ZodType;
}
type ResponseObjectWithId = ResponseObject & { id: string };
export type ResponseObjectsWithId = [ResponseObjectWithId, ResponseObjectWithId, ...ResponseObjectWithId[]];
export interface ResponsesObject {
    [statusCode: string]: ResponseObject | ResponseObjectsWithId;
}

export interface Specification<Params = ZodUnknown, Query = ZodUnknown, Responses = ResponsesObject, Body = ZodUnknown> {
    path: string;
    method: Method;
    tag: Tag;
    role: Role[] | Role | null;
    summary: string;
    description?: string;
    parameters?: Params;
    query?: Query;
    body?: Body;
    responses: Responses;
}

// Utility types to convert Responses into a set of possible schemas
// This type takes in a ResponseObject or ResponseObjectsWithId and returns the underlying inferred zod types
type InferResponseBody<T> = T extends ResponseObject
    ? z.infer<T["schema"]>
    : T extends ResponseObjectsWithId
    ? z.infer<T[number]["schema"]>
    : never;

// This type indexes each possible key in the ResponsesObject and passes it to InferResponseBody to get the underlying types
export type ResponseBody<T extends ResponsesObject> = InferResponseBody<T[keyof T]>;

// Utility type for a zod object which is really just empty (not just {} in ts)
export type ZodEmptyObject = ZodObject<NonNullable<unknown>>;

export default function specification<
    Responses extends ResponsesObject,
    Params extends AnyZodObject = ZodEmptyObject,
    Query extends AnyZodObject = ZodEmptyObject,
    Body extends ZodType = ZodUnknown,
>(
    spec: Specification<Params, Query, Responses, Body>,
): RequestHandler<z.infer<Params>, ResponseBody<Responses>, z.infer<Body>, z.infer<Query>> {
    registerPathSpecification(spec);
    return specificationValidator(spec);
}
