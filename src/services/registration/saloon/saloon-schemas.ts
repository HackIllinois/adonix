// Shapes of the Saloon Rush world.json (our floor plan) and plan.json (the applicant's submission).
// Kept free of Adonix-specific imports so the grader can be bundled into a standalone local checker.
import { z, ZodError } from "zod";

const MAX_ID_LENGTH = 64;
const MAX_NODES = 2000;
const MAX_CONNECTIONS = 10000;
const MAX_MERCENARIES = 50;
const MAX_CONTRACTS = 2000;
const MAX_COMMANDS_PER_MERCENARY = 10000;
const MAX_NAME_LENGTH = 200;
const MIN_CROWD = 1;
const MAX_CROWD = 2.5;
const CROWD_STEPS_PER_UNIT = 10;
const FLOAT_TOLERANCE = 1e-9;
const MAX_REPORTED_ISSUES = 5;

const IdSchema = z.string().min(1).max(MAX_ID_LENGTH);
const MinuteSchema = z.number().int().nonnegative();

export const MercenaryClassSchema = z.enum(["disguiser", "pickpocket", "heavy_lifter"]);
export type MercenaryClass = z.infer<typeof MercenaryClassSchema>;

export const ConnectionTagSchema = z.enum(["crawlspace", "main_floor"]);
export type ConnectionTag = z.infer<typeof ConnectionTagSchema>;

export const NodeTypeSchema = z.enum(["hideout", "game_table", "back_room", "hallway"]);

// Crowd has at most one decimal place so travel times can be computed with integer math.
const CrowdSchema = z
    .number()
    .min(MIN_CROWD)
    .max(MAX_CROWD)
    .refine(
        (c) => Math.abs(c * CROWD_STEPS_PER_UNIT - Math.round(c * CROWD_STEPS_PER_UNIT)) < FLOAT_TOLERANCE,
        "crowd must have at most one decimal place",
    );

export const WorldSchema = z.object({
    instance: IdSchema,
    shift_end: MinuteSchema,
    coins: z.number().int().nonnegative().optional(),
    nodes: z
        .array(
            z.object({
                id: IdSchema,
                type: NodeTypeSchema,
                name: z.string().max(MAX_NAME_LENGTH).optional(),
            }),
        )
        .min(1)
        .max(MAX_NODES),
    connections: z
        .array(
            z.object({
                a: IdSchema,
                b: IdSchema,
                length: z.number().int().positive(),
                crowd: CrowdSchema,
                tags: z.array(ConnectionTagSchema).default([]),
            }),
        )
        .max(MAX_CONNECTIONS),
    mercenaries: z
        .array(
            z.object({
                id: IdSchema,
                class: MercenaryClassSchema,
                hideout: IdSchema,
            }),
        )
        .min(1)
        .max(MAX_MERCENARIES),
    contracts: z
        .array(
            z.object({
                id: IdSchema,
                table: IdSchema,
                back_room: IdSchema,
                ready_at: MinuteSchema,
                deadline: MinuteSchema,
            }),
        )
        .max(MAX_CONTRACTS),
});
export type World = z.infer<typeof WorldSchema>;
export type WorldContract = World["contracts"][number];

const GoCommandSchema = z.object({ t: MinuteSchema, cmd: z.literal("go"), to: IdSchema }).strict();
const PickupCommandSchema = z.object({ t: MinuteSchema, cmd: z.literal("pickup"), contract: IdSchema }).strict();
const DropoffCommandSchema = z.object({ t: MinuteSchema, cmd: z.literal("dropoff"), contract: IdSchema }).strict();

export const CommandSchema = z.discriminatedUnion("cmd", [GoCommandSchema, PickupCommandSchema, DropoffCommandSchema]);
export type Command = z.infer<typeof CommandSchema>;

export const PlanSchema = z
    .object({
        instance: IdSchema,
        gang: z.string().max(MAX_NAME_LENGTH).optional(),
        routes: z.record(IdSchema, z.array(CommandSchema).max(MAX_COMMANDS_PER_MERCENARY)),
        // The bar menu only exists in Tier 3. An empty list is tolerated so one plan format works everywhere.
        bar_orders: z.array(z.unknown()).max(0, "bar orders aren't on the menu in this tier").optional(),
    })
    .strict();
export type Plan = z.infer<typeof PlanSchema>;

export const RouteErrorSchema = z.object({
    mercenary: z.string(),
    index: z.number().int(),
    message: z.string(),
});
export type RouteError = z.infer<typeof RouteErrorSchema>;

export const GradeReportSchema = z.object({
    instance: z.string(),
    score: z.number().int(),
    totalContracts: z.number().int(),
    completed: z.number().int(),
    onTime: z.number().int(),
    lateMinutes: z.number().int(),
    travelMinutes: z.number().int(),
    errors: z.array(RouteErrorSchema),
});
export type GradeReport = z.infer<typeof GradeReportSchema>;

/**
 * A plan that can't be graded at all (bad JSON, wrong shape, wrong instance, unknown ids).
 * Invalid commands inside an otherwise well-formed plan are NOT this - they just cut that mercenary's route.
 */
export class InvalidPlanError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "InvalidPlanError";
    }
}

function formatZodError(error: ZodError): string {
    const issues = error.issues.slice(0, MAX_REPORTED_ISSUES).map((issue) => {
        const path = issue.path.reduce<string>((acc, part) => {
            if (typeof part === "number") {
                return `${acc}[${part}]`;
            }
            return acc ? `${acc}.${part}` : `${part}`;
        }, "");
        return `${path || "(root)"}: ${issue.message}`;
    });
    const extra = error.issues.length > MAX_REPORTED_ISSUES ? ` (+${error.issues.length - MAX_REPORTED_ISSUES} more)` : "";
    return issues.join("; ") + extra;
}

/** Parses raw plan.json text. Throws InvalidPlanError with a readable reason. */
export function parsePlan(text: string): Plan {
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch (err) {
        throw new InvalidPlanError(`plan.json is not valid JSON: ${(err as Error).message}`);
    }
    const result = PlanSchema.safeParse(raw);
    if (!result.success) {
        throw new InvalidPlanError(`plan.json has the wrong shape: ${formatZodError(result.error)}`);
    }
    return result.data;
}

/** Parses and sanity-checks a world.json. Throws a plain Error since a bad floor plan is our bug, not the applicant's. */
export function parseWorld(raw: unknown): World {
    const result = WorldSchema.safeParse(raw);
    if (!result.success) {
        throw new Error(`Invalid world.json: ${formatZodError(result.error)}`);
    }
    const world = result.data;

    const nodeIds = new Set<string>();
    for (const node of world.nodes) {
        if (nodeIds.has(node.id)) {
            throw new Error(`Invalid world.json: duplicate spot ${node.id}`);
        }
        nodeIds.add(node.id);
    }
    const requireNode = (id: string, where: string): void => {
        if (!nodeIds.has(id)) {
            throw new Error(`Invalid world.json: ${where} references unknown spot ${id}`);
        }
    };
    world.connections.forEach((connection, i) => {
        requireNode(connection.a, `connections[${i}]`);
        requireNode(connection.b, `connections[${i}]`);
    });
    const mercenaryIds = new Set<string>();
    for (const mercenary of world.mercenaries) {
        if (mercenaryIds.has(mercenary.id)) {
            throw new Error(`Invalid world.json: duplicate mercenary ${mercenary.id}`);
        }
        mercenaryIds.add(mercenary.id);
        requireNode(mercenary.hideout, `mercenary ${mercenary.id}`);
    }
    const contractIds = new Set<string>();
    for (const contract of world.contracts) {
        if (contractIds.has(contract.id)) {
            throw new Error(`Invalid world.json: duplicate contract ${contract.id}`);
        }
        contractIds.add(contract.id);
        requireNode(contract.table, `contract ${contract.id}`);
        requireNode(contract.back_room, `contract ${contract.id}`);
    }
    return world;
}
