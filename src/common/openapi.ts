import { OpenApiGeneratorV31, OpenAPIRegistry, RouteConfig } from "@asteasolutions/zod-to-openapi";
import { AnyZodObject } from "zod";
import type { InfoObject, OpenAPIObject, ServerObject } from "openapi3-ts/oas31";
import Config from "./config";
import { ResponsesObject, Specification } from "../middleware/specification";

let openAPISpec: OpenAPIObject | undefined = undefined;
export const Registry = new OpenAPIRegistry();

// Basic metadata
const openapi = "3.1.0";

const info: InfoObject = {
    title: "adonix",
    version: "1.0.0",
    description:
        "HackIllinois' backend API\n\n" +
        `[Attendee Authentication](${Config.ROOT_URL}/auth/login/github?device=dev)\n\n` +
        `[Staff Authentication](${Config.ROOT_URL}/auth/login/google?device=dev)`,
};

const servers: ServerObject[] = [
    {
        url: Config.ROOT_URL,
        description: Config.PROD ? "Production" : "Local",
    },
];

// Security component
const authentication = Registry.registerComponent("securitySchemes", "Authentication", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "jwt",
});

function generateOpenAPISpec(): OpenAPIObject {
    const generator = new OpenApiGeneratorV31(Registry.definitions);
    return generator.generateDocument({
        info,
        openapi,
        servers,
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
    const { method, path, tag, role, summary, description, parameters: params } = specification;
    const security = role
        ? [
              {
                  [authentication.name]: [role],
              },
          ]
        : undefined;
    const descriptionHeader = role && `**Required role: ${role}**`;
    let combinedDescription: string | undefined = undefined;
    if (description && descriptionHeader) {
        combinedDescription = `${descriptionHeader}\n\n${description}`;
    } else {
        combinedDescription = descriptionHeader || description;
    }

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
        security,
        responses,
        request,
        summary,
        description: combinedDescription,
        tags: [tag],
    });
}
