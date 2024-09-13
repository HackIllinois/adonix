import { OpenApiGeneratorV31, OpenAPIRegistry, RouteConfig } from "@asteasolutions/zod-to-openapi";
import { AnyZodObject } from "zod";
import type { OpenAPIObject } from "openapi3-ts/oas31";
import Config from "./config";
import { ResponsesObject, Specification } from "./middleware/specification";

let openAPISpec: OpenAPIObject | undefined = undefined;
export const Registry = new OpenAPIRegistry();

function generateOpenAPISpec(): OpenAPIObject {
    const generator = new OpenApiGeneratorV31(Registry.definitions);
    return generator.generateDocument({
        info: {
            title: "adonix",
            version: "1.0.0",
            description: "HackIllinois' backend API",
        },
        openapi: "3.1.0",
        servers: [
            {
                url: Config.ROOT_URL,
                description: Config.PROD ? "Production" : "Local",
            },
        ],
    });
}

export function getOpenAPISpec(): OpenAPIObject {
    if (!openAPISpec) {
        openAPISpec = generateOpenAPISpec();
    }

    return openAPISpec;
}

export function registerPathSpecification<
    Params extends AnyZodObject,
    Responses extends ResponsesObject,
    Body extends AnyZodObject,
>(specification: Specification<Params, Responses, Body>): void {
    const { method, path, summary, parameters: params, tag } = specification;

    const responses: RouteConfig["responses"] = {};
    for (const [statusCode, response] of Object.entries(specification.responses)) {
        responses[statusCode] = {
            description: response.description,
            content: {
                "application/json": {
                    schema: response.schema,
                },
            },
        };
    }

    const request: RouteConfig["request"] = { params };
    if (specification.body) {
        request.body = {
            content: {
                "application/json": {
                    schema: specification.body,
                },
            },
        };
    }

    Registry.registerPath({
        method,
        path,
        responses,
        request,
        summary,
        tags: [tag],
    });
}
