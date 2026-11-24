// Shapes of the Saloon Mercenary world.json (the saloon map) and plan.json (the applicant's submission).
// Kept free of Adonix-specific imports so the grader can be bundled into a standalone local checker.
import { z, ZodError } from "zod";

const MAX_ID_LENGTH = 64;
const MAX_NODES = 2000;
const MAX_EDGES = 10000;
const MAX_DRIVERS = 50;
const MAX_ORDERS = 2000;
const MAX_COMMANDS_PER_DRIVER = 10000;
const MAX_POWERUPS = 2000;
const MAX_NAME_LENGTH = 200;
const MIN_CONGESTION = 1;
const MAX_CONGESTION = 2.5;
const CONGESTION_STEPS_PER_UNIT = 10;
const FLOAT_TOLERANCE = 1e-9;
const MAX_REPORTED_ISSUES = 5;

const IdSchema = z.string().min(1).max(MAX_ID_LENGTH);
const MinuteSchema = z.number().int().nonnegative();

export const DriverClassSchema = z.enum(["disguiser", "speedster", "hauler"]);
export type DriverClass = z.infer<typeof DriverClassSchema>;

export const EdgeTagSchema = z.enum(["narrow", "exposed"]);
export type EdgeTag = z.infer<typeof EdgeTagSchema>;

export const NodeTypeSchema = z.enum(["starting-location", "target", "fence", "intersection"]);

// Congestion has at most one decimal place so travel times can be computed with integer math.
const CongestionSchema = z
    .number()
    .min(MIN_CONGESTION)
    .max(MAX_CONGESTION)
    .refine(
        (c) => Math.abs(c * CONGESTION_STEPS_PER_UNIT - Math.round(c * CONGESTION_STEPS_PER_UNIT)) < FLOAT_TOLERANCE,
        "congestion must have at most one decimal place",
    );

export const WorldSchema = z.object({
    instance: IdSchema,
    shift_end: MinuteSchema,
    // Coins the gang starts with (spent on power-ups in Tier 3)
    coins: z.number().int().nonnegative().default(0),
    // Power-ups are only available in Tier 3
    powerups_enabled: z.boolean().default(false),
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
    edges: z
        .array(
            z.object({
                a: IdSchema,
                b: IdSchema,
                length: z.number().int().positive(),
                congestion: CongestionSchema,
                tags: z.array(EdgeTagSchema).default([]),
            }),
        )
        .max(MAX_EDGES),
    drivers: z
        .array(
            z.object({
                id: IdSchema,
                class: DriverClassSchema,
                start: IdSchema,
            }),
        )
        .min(1)
        .max(MAX_DRIVERS),
    orders: z
        .array(
            z.object({
                id: IdSchema,
                target: IdSchema,
                fence: IdSchema,
                ready_at: MinuteSchema,
                deadline: MinuteSchema,
            }),
        )
        .max(MAX_ORDERS),
});
export type World = z.infer<typeof WorldSchema>;
export type WorldOrder = World["orders"][number];

const GoCommandSchema = z.object({ t: MinuteSchema, cmd: z.literal("go"), to: IdSchema }).strict();
const PickupCommandSchema = z.object({ t: MinuteSchema, cmd: z.literal("pickup"), order: IdSchema }).strict();
const DropoffCommandSchema = z.object({ t: MinuteSchema, cmd: z.literal("dropoff"), order: IdSchema }).strict();

export const CommandSchema = z.discriminatedUnion("cmd", [GoCommandSchema, PickupCommandSchema, DropoffCommandSchema]);
export type Command = z.infer<typeof CommandSchema>;

// Power-ups (Tier 3): each one is bought and activated in one command, at minute t
const CactusCocktailSchema = z.object({ t: MinuteSchema, type: z.literal("cactus_cocktail"), order: IdSchema }).strict();
const BigBellyBurgerSchema = z.object({ t: MinuteSchema, type: z.literal("big_belly_burger"), driver: IdSchema }).strict();
const ExtraSatchelSchema = z.object({ t: MinuteSchema, type: z.literal("extra_satchel"), driver: IdSchema }).strict();

export const PowerupSchema = z.discriminatedUnion("type", [CactusCocktailSchema, BigBellyBurgerSchema, ExtraSatchelSchema]);
export type Powerup = z.infer<typeof PowerupSchema>;

export const PlanSchema = z
    .object({
        instance: IdSchema,
        team: z.string().max(MAX_NAME_LENGTH).optional(),
        routes: z.record(IdSchema, z.array(CommandSchema).max(MAX_COMMANDS_PER_DRIVER)),
        // Only allowed when the world has power-ups enabled (Tier 3). An empty list is fine everywhere.
        powerups: z.array(PowerupSchema).max(MAX_POWERUPS).optional(),
    })
    .strict();
export type Plan = z.infer<typeof PlanSchema>;

export const RouteErrorSchema = z.object({
    driver: z.string(),
    index: z.number().int(),
    message: z.string(),
});
export type RouteError = z.infer<typeof RouteErrorSchema>;

export const PowerupErrorSchema = z.object({
    index: z.number().int(),
    message: z.string(),
});
export type PowerupError = z.infer<typeof PowerupErrorSchema>;

export const GradeReportSchema = z.object({
    instance: z.string(),
    score: z.number().int(),
    totalOrders: z.number().int(),
    completed: z.number().int(),
    onTime: z.number().int(),
    lateMinutes: z.number().int(),
    travelMinutes: z.number().int(),
    errors: z.array(RouteErrorSchema),
    // Tier 3 power-ups. Always present; 0 / [] when power-ups are off.
    coinsEarned: z.number().int(),
    coinsSpent: z.number().int(),
    powerupErrors: z.array(PowerupErrorSchema),
});
export type GradeReport = z.infer<typeof GradeReportSchema>;

/**
 * A plan that can't be graded at all (bad JSON, wrong shape, wrong instance, unknown ids).
 * Invalid commands inside an otherwise well-formed plan are NOT this - they just cut that driver's route.
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

/** Parses and sanity-checks a world.json. Throws a plain Error since a bad world is our bug, not the applicant's. */
export function parseWorld(raw: unknown): World {
    const result = WorldSchema.safeParse(raw);
    if (!result.success) {
        throw new Error(`Invalid world.json: ${formatZodError(result.error)}`);
    }
    const world = result.data;

    const nodeIds = new Set<string>();
    for (const node of world.nodes) {
        if (nodeIds.has(node.id)) {
            throw new Error(`Invalid world.json: duplicate node ${node.id}`);
        }
        nodeIds.add(node.id);
    }
    const requireNode = (id: string, where: string): void => {
        if (!nodeIds.has(id)) {
            throw new Error(`Invalid world.json: ${where} references unknown node ${id}`);
        }
    };
    world.edges.forEach((edge, i) => {
        requireNode(edge.a, `edges[${i}]`);
        requireNode(edge.b, `edges[${i}]`);
    });
    const driverIds = new Set<string>();
    for (const driver of world.drivers) {
        if (driverIds.has(driver.id)) {
            throw new Error(`Invalid world.json: duplicate driver ${driver.id}`);
        }
        driverIds.add(driver.id);
        requireNode(driver.start, `driver ${driver.id}`);
    }
    const orderIds = new Set<string>();
    for (const order of world.orders) {
        if (orderIds.has(order.id)) {
            throw new Error(`Invalid world.json: duplicate order ${order.id}`);
        }
        orderIds.add(order.id);
        requireNode(order.target, `order ${order.id}`);
        requireNode(order.fence, `order ${order.id}`);
    }
    return world;
}
