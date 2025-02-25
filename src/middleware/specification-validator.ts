import { AnyZodObject, z, ZodIssue, ZodType } from "zod";
import { ResponseBody, ResponsesObject, Specification } from "./specification";
import { Request, Response, NextFunction, RequestHandler } from "express-serve-static-core";
import { getAuthenticatedUser } from "../common/auth";
import StatusCode from "status-code-enum";
import { APIError } from "../common/schemas";
import { Role } from "../services/auth/auth-schemas";

export class MissingRoleError extends APIError<string, string> {
    constructor(role: Role[] | Role) {
        if (Array.isArray(role)) {
            super("Forbidden", `You require one of the roles: ${role.join(", ")} to do that`, StatusCode.ClientErrorForbidden);
        } else {
            super("Forbidden", `You require the role ${role} to do that`, StatusCode.ClientErrorForbidden);
        }
    }
}

export class SpecificationError extends APIError<string, string> {
    constructor(errors: Record<string, ZodIssue[]>) {
        const summary = Object.entries(errors)
            .flatMap(([location, issues]) =>
                issues.map(
                    ({ code, message, path }) =>
                        `  - ${code} in ${location}${path.length > 0 ? `.${path.join(".")}` : ""}: ${message}`,
                ),
            )
            .join("\n");
        super("BadRequest", `Bad request made - invalid format.\n${summary}`, StatusCode.ClientErrorBadRequest, errors);
    }
}

async function validateSchema(schema: ZodType | undefined, data: unknown): Promise<ZodIssue[]> {
    if (schema) {
        const result = await schema.safeParseAsync(data);
        if (!result.success) {
            return result.error.errors;
        }
    }

    return [];
}

export function specificationValidator<
    Params extends AnyZodObject,
    Query extends AnyZodObject,
    Responses extends ResponsesObject,
    Body extends ZodType,
>(
    spec: Specification<Params, Query, Responses, Body>,
): RequestHandler<z.infer<Params>, ResponseBody<Responses>, z.infer<Body>, z.infer<Query>> {
    return async (req: Request, _res: Response, next: NextFunction) => {
        if (spec.role) {
            const jwt = getAuthenticatedUser(req);
            const allowedRoles = Array.isArray(spec.role) ? spec.role : [spec.role];
            const allowed = allowedRoles.some((role) => jwt.roles.includes(role));
            if (!allowed) {
                throw new MissingRoleError(spec.role);
            }
        }

        const errors: Record<string, ZodIssue[]> = {
            parameters: await validateSchema(spec.parameters, req.params),
            query: await validateSchema(spec.query, req.query),
            body: await validateSchema(spec.body, req.body),
        };

        if (Object.values(errors).flat().length > 0) {
            throw new SpecificationError(errors);
        }

        return next();
    };
}
