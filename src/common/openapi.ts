import { OpenApiGeneratorV31, OpenAPIRegistry, RouteConfig } from "@asteasolutions/zod-to-openapi";
import { AnyZodObject, z, ZodType } from "zod";
import type { ExampleObject, InfoObject, OpenAPIObject, SecurityRequirementObject, ServerObject } from "openapi3-ts/oas31";
import Config from "./config";
import { ResponsesObject, Specification } from "../middleware/specification";
import { SwaggerUiOptions } from "swagger-ui-express";

let openAPISpec: OpenAPIObject | undefined = undefined;
export const Registry = new OpenAPIRegistry();

// Swagger settings
export const SWAGGER_UI_OPTIONS: SwaggerUiOptions = {
    swaggerUrl: `${Config.ROOT_URL}/docs/json`,
    customSiteTitle: "Adonix API Docs",
    swaggerOptions: {
        persistAuthorization: true,
    },
};

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
    const document = generator.generateDocument({
        info,
        openapi,
        servers,
    });

    // Sort paths by name
    if (document.paths) {
        const sortedEntries = Object.entries(document.paths).sort();
        document.paths = sortedEntries.reduce(
            (acc, [k, v]) => {
                acc[k] = v;
                return acc;
            },
            {} satisfies typeof document.paths as typeof document.paths,
        );
    }

    // Sort components by name
    if (document.components?.schemas) {
        const sortedEntries = Object.entries(document.components?.schemas).sort();
        document.components.schemas = sortedEntries.reduce(
            (acc, [k, v]) => {
                acc[k] = v;
                return acc;
            },
            {} satisfies typeof document.components.schemas as typeof document.components.schemas,
        );
    }

    return document;
}

export function getOpenAPISpec(): OpenAPIObject {
    if (!openAPISpec) {
        openAPISpec = generateOpenAPISpec();
    }

    return openAPISpec;
}

// Given a specification, returns the route responses in openapi format
function getPathResponsesForSpecification<
    Params extends AnyZodObject,
    Query extends AnyZodObject,
    Responses extends ResponsesObject,
    Body extends ZodType,
>(specification: Specification<Params, Query, Responses, Body>): RouteConfig["responses"] {
    const responses: RouteConfig["responses"] = {};

    for (const [statusCode, response] of Object.entries(specification.responses)) {
        // response can be a single response or an array of responses for this status code
        // First, check for the easy singular case
        if (!Array.isArray(response)) {
            const { description, schema } = response;
            responses[statusCode] = {
                description,
                content: {
                    "application/json": {
                        schema,
                    },
                },
            };
        } else {
            // Otherwise, we need to combine these multiple responses for the same status code into a singular entry
            const description =
                "One of:\n" +
                response.map((r) => `- ${r.id}: ${r.description}`).join("\n") +
                "\n\n**See examples dropdown below**";
            const schemas = response.map((r) => r.schema) as [ZodType, ZodType, ...ZodType[]];
            const examples = response.reduce<Record<string, ExampleObject>>((acc, r) => {
                const example = r.schema._def.openapi?.metadata?.example;
                if (example) {
                    if (acc[r.id]) {
                        throw Error(
                            `Duplicate definition of response id ${r.id} for ${specification.method} ${specification.path} status ${statusCode}`,
                        );
                    }
                    acc[r.id] = {
                        description: r.description,
                        value: example,
                    };
                }
                return acc;
            }, {});
            responses[statusCode] = {
                description,
                content: {
                    "application/json": {
                        schema: z.union(schemas),
                        examples,
                    },
                },
            };
        }
    }

    return responses;
}

function getSecurityForRole(role: Specification["role"]): SecurityRequirementObject[] | undefined {
    if (role) {
        return [
            {
                [authentication.name]: [role],
            },
        ];
    }
    return [
        {},
        {
            [authentication.name]: [],
        },
    ];
}

function getCombinedDescriptionWithRole(description: string | undefined, role: Specification["role"]): string | undefined {
    const header = role && `**Required role: ${role}**`;

    if (description && header) {
        return `${header}\n\n${description}`;
    } else {
        return header || description;
    }
}

export function registerPathSpecification<
    Params extends AnyZodObject,
    Query extends AnyZodObject,
    Responses extends ResponsesObject,
    Body extends ZodType,
>(specification: Specification<Params, Query, Responses, Body>): void {
    // Convert specification into RouteConfig
    const { method, path, tag, role, summary, description, parameters: params, query } = specification;
    const security = getSecurityForRole(role);
    const combinedDescription = getCombinedDescriptionWithRole(description, role);

    const responses = getPathResponsesForSpecification(specification);

    const request: RouteConfig["request"] = { params, query };
    if (specification.body) {
        request.body = {
            content: {
                "application/json": {
                    schema: specification.body,
                },
            },
        };
    }

    // Check for duplicate definitions
    const existingDefinitions = Registry.definitions.filter(
        (def) => def.type == "route" && def.route.method == method && def.route.path == path,
    );

    if (existingDefinitions.length > 0) {
        throw Error(`Duplicate definition of ${method} ${path}`);
    }

    // Register
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
