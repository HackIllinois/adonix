// Deterministic replay and scoring of a Dispatch Rush plan.
import { DRIVER_CLASSES, getTravelTimes } from "./dispatch-graph";
import { Command, GradeReport, InvalidPlanError, Plan, RouteError, World, WorldOrder } from "./dispatch-schemas";

export const SCORING = {
    POINTS_PER_ORDER: 100,
    PENALTY_PER_LATE_MINUTE: 5,
    MIN_POINTS_PER_DELIVERY: 20,
} as const;

// When commands from different drivers share a minute: dropoffs first, then power-ups, then everything else
const DROPOFF_PRIORITY = 0;
const OTHER_PRIORITY = 2;

function commandPriority(cmd: Command): number {
    return cmd.cmd === "dropoff" ? DROPOFF_PRIORITY : OTHER_PRIORITY;
}

/** Points for one delivery: 100, minus 5 per minute late, never below 20. */
export function deliveryPoints(dropoffT: number, deadline: number): number {
    const late = Math.max(0, dropoffT - deadline);
    return Math.max(SCORING.MIN_POINTS_PER_DELIVERY, SCORING.POINTS_PER_ORDER - SCORING.PENALTY_PER_LATE_MINUTE * late);
}

interface DriverState {
    id: string;
    commands: Command[];
    next: number;
    cut: boolean;
    node: string;
    t: number;
    carrying: Set<string>;
    capacity: number;
    travel: ReturnType<typeof getTravelTimes>;
}

interface OrderState {
    order: WorldOrder;
    pickedUpBy: string | null;
    deliveredAt: number | null;
}

/** Rejects plans that can't be graded at all, before any replay. */
function checkPlanReferences(world: World, plan: Plan): void {
    if (plan.instance !== world.instance) {
        throw new InvalidPlanError(`plan.instance is "${plan.instance}", but your world is "${world.instance}"`);
    }
    const driverIds = new Set(world.drivers.map((d) => d.id));
    const nodeIds = new Set(world.nodes.map((n) => n.id));
    const orderIds = new Set(world.orders.map((o) => o.id));

    for (const [driverId, commands] of Object.entries(plan.routes)) {
        if (!driverIds.has(driverId)) {
            throw new InvalidPlanError(`routes has unknown driver "${driverId}"`);
        }
        commands.forEach((cmd, i) => {
            if (cmd.cmd === "go" && !nodeIds.has(cmd.to)) {
                throw new InvalidPlanError(`${driverId}[${i}]: unknown node "${cmd.to}"`);
            }
            if (cmd.cmd !== "go" && !orderIds.has(cmd.order)) {
                throw new InvalidPlanError(`${driverId}[${i}]: unknown order "${cmd.order}"`);
            }
        });
    }
}

/**
 * Replays a plan against a world and scores it.
 * Throws InvalidPlanError for a broken file. An invalid command only cuts the rest of that driver's route.
 */
export function gradePlan(world: World, plan: Plan): GradeReport {
    checkPlanReferences(world, plan);

    const orders = new Map<string, OrderState>(
        world.orders.map((order) => [order.id, { order, pickedUpBy: null, deliveredAt: null }]),
    );
    const drivers: DriverState[] = world.drivers.map((driver) => ({
        id: driver.id,
        commands: plan.routes[driver.id] ?? [],
        next: 0,
        cut: false,
        node: driver.start,
        t: 0,
        carrying: new Set(),
        capacity: DRIVER_CLASSES[driver.class].capacity,
        travel: getTravelTimes(world, driver.class),
    }));

    const errors: RouteError[] = [];
    let travelMinutes = 0;

    // Returns an error message if the command is invalid, otherwise applies it
    const apply = (driver: DriverState, cmd: Command): string | null => {
        if (cmd.t < driver.t) {
            return `${cmd.cmd} at t=${cmd.t} is earlier than the previous command at t=${driver.t}`;
        }
        if (cmd.t > world.shift_end) {
            return `${cmd.cmd} at t=${cmd.t} is after shift_end=${world.shift_end}`;
        }

        if (cmd.cmd === "go") {
            const minutes = driver.travel.between(driver.node, cmd.to);
            if (minutes === null) {
                return `go to ${cmd.to}: no route from ${driver.node} that this driver can use`;
            }
            const earliest = driver.t + minutes;
            if (cmd.t < earliest) {
                return `go to ${cmd.to} at t=${cmd.t}, earliest possible t=${earliest}`;
            }
            driver.node = cmd.to;
            travelMinutes += minutes;
        } else {
            const state = orders.get(cmd.order)!;
            const { order } = state;
            if (cmd.cmd === "pickup") {
                if (driver.node !== order.restaurant) {
                    return `pickup ${order.id} at ${driver.node}, but its restaurant is ${order.restaurant}`;
                }
                if (cmd.t < order.ready_at) {
                    return `pickup ${order.id} at t=${cmd.t}, but it is not ready until t=${order.ready_at}`;
                }
                if (state.pickedUpBy !== null) {
                    return `pickup ${order.id}, but it was already picked up by ${state.pickedUpBy}`;
                }
                if (driver.carrying.size >= driver.capacity) {
                    return `pickup ${order.id}, but the driver is full (${driver.capacity}/${driver.capacity})`;
                }
                state.pickedUpBy = driver.id;
                driver.carrying.add(order.id);
            } else {
                if (!driver.carrying.has(order.id)) {
                    return `dropoff ${order.id}, but the driver is not carrying it`;
                }
                if (driver.node !== order.house) {
                    return `dropoff ${order.id} at ${driver.node}, but its house is ${order.house}`;
                }
                driver.carrying.delete(order.id);
                state.deliveredAt = cmd.t;
            }
        }

        driver.t = cmd.t;
        return null;
    };

    // Merge every driver's queue by (t, priority, driver order). Only queue heads are compared,
    // so each driver's own commands always run in the order they were written.
    for (;;) {
        let chosen: DriverState | null = null;
        for (const driver of drivers) {
            if (driver.cut || driver.next >= driver.commands.length) {
                continue;
            }
            if (!chosen) {
                chosen = driver;
                continue;
            }
            const a = driver.commands[driver.next]!;
            const b = chosen.commands[chosen.next]!;
            if (a.t < b.t || (a.t === b.t && commandPriority(a) < commandPriority(b))) {
                chosen = driver;
            }
        }
        if (!chosen) {
            break;
        }

        const index = chosen.next;
        const message = apply(chosen, chosen.commands[index]!);
        chosen.next += 1;
        if (message !== null) {
            chosen.cut = true;
            errors.push({ driver: chosen.id, index, message: `${chosen.id}[${index}]: ${message}` });
        }
    }

    let score = 0;
    let delivered = 0;
    let onTime = 0;
    let lateMinutes = 0;
    for (const { order, deliveredAt } of orders.values()) {
        if (deliveredAt === null) {
            continue;
        }
        delivered += 1;
        const late = Math.max(0, deliveredAt - order.deadline);
        if (late === 0) {
            onTime += 1;
        }
        lateMinutes += late;
        score += deliveryPoints(deliveredAt, order.deadline);
    }

    return {
        instance: world.instance,
        score,
        totalOrders: world.orders.length,
        delivered,
        onTime,
        lateMinutes,
        travelMinutes,
        errors,
    };
}
