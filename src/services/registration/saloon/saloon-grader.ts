// Deterministic replay and scoring of a Saloon Mercenary plan.
import { DRIVER_CLASSES, getTravelTimes } from "./saloon-graph";
import {
    Command,
    DriverClass,
    GradeReport,
    InvalidPlanError,
    Plan,
    Powerup,
    PowerupError,
    RouteError,
    World,
    WorldOrder,
} from "./saloon-schemas";

export const SCORING = {
    POINTS_PER_ORDER: 100,
    PENALTY_PER_LATE_MINUTE: 5,
    MIN_POINTS_PER_ORDER: 20,
} as const;

// Tier 3: fences pay coins for jewelry delivered on time, and coins buy power-ups
export const COINS = {
    ON_TIME: 50,
    EARLY: 100,
    EARLY_MINUTES: 10,
} as const;

export const POWERUPS = {
    // One driver moves 1.5x faster for a while
    big_belly_burger: { cost: 300, minutes: 30 },
    // The fence gets tipsy and pushes back one order's deadline
    cactus_cocktail: { cost: 150, extraMinutes: 15 },
    // One driver carries 2 more pieces for the rest of the shift
    extra_satchel: { cost: 400, extraCapacity: 2 },
} as const;

export const POWERUPS_DISABLED_MESSAGE = "power-ups aren't available in this tier";

/** Points for one delivered order: 100, minus 5 per minute late, never below 20. */
export function orderPoints(dropoffT: number, deadline: number): number {
    const late = Math.max(0, dropoffT - deadline);
    return Math.max(SCORING.MIN_POINTS_PER_ORDER, SCORING.POINTS_PER_ORDER - SCORING.PENALTY_PER_LATE_MINUTE * late);
}

/** Coins for one dropoff: 100 if at least 10 minutes early, 50 if on time, otherwise none. */
export function orderCoins(dropoffT: number, deadline: number): number {
    if (dropoffT > deadline) {
        return 0;
    }
    return deadline - dropoffT >= COINS.EARLY_MINUTES ? COINS.EARLY : COINS.ON_TIME;
}

interface DriverState {
    id: string;
    driverClass: DriverClass;
    commands: Command[];
    next: number;
    cut: boolean;
    node: string;
    t: number;
    carrying: Set<string>;
    capacity: number;
    // Minutes when this driver ate a Big Belly Burger
    burgers: number[];
}

interface OrderState {
    order: WorldOrder;
    stolenBy: string | null;
    deliveredAt: number | null;
    // Extra minutes from Cactus Cocktails
    extension: number;
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

    const powerups = plan.powerups ?? [];
    if (powerups.length > 0 && !world.powerups_enabled) {
        throw new InvalidPlanError(POWERUPS_DISABLED_MESSAGE);
    }
    powerups.forEach((powerup, i) => {
        if (powerup.type === "cactus_cocktail") {
            if (!orderIds.has(powerup.order)) {
                throw new InvalidPlanError(`powerups[${i}]: unknown order "${powerup.order}"`);
            }
        } else if (!driverIds.has(powerup.driver)) {
            throw new InvalidPlanError(`powerups[${i}]: unknown driver "${powerup.driver}"`);
        }
    });
}

/**
 * Replays a plan against a world and scores it.
 * Throws InvalidPlanError for a broken file. An invalid command only cuts the rest of that driver's route,
 * and a power-up that can't be bought is skipped.
 */
export function gradePlan(world: World, plan: Plan): GradeReport {
    checkPlanReferences(world, plan);

    const orders = new Map<string, OrderState>(
        world.orders.map((order) => [order.id, { order, stolenBy: null, deliveredAt: null, extension: 0 }]),
    );
    const drivers: DriverState[] = world.drivers.map((driver) => ({
        id: driver.id,
        driverClass: driver.class,
        commands: plan.routes[driver.id] ?? [],
        next: 0,
        cut: false,
        node: driver.start,
        t: 0,
        carrying: new Set(),
        capacity: DRIVER_CLASSES[driver.class].capacity,
        burgers: [],
    }));
    const driversById = new Map(drivers.map((d) => [d.id, d]));
    // Power-ups are bought in time order; ties keep their order in the file
    const powerupQueue = (plan.powerups ?? [])
        .map((powerup, index) => ({ powerup, index }))
        .sort((a, b) => a.powerup.t - b.powerup.t || a.index - b.index);
    let nextPowerup = 0;

    const errors: RouteError[] = [];
    const powerupErrors: PowerupError[] = [];
    let travelMinutes = 0;
    // Coins only matter while power-ups are enabled (Tier 3), so they stay at 0 everywhere else
    let coinsEarned = world.powerups_enabled ? world.coins : 0;
    let coinsSpent = 0;

    const deadlineOf = (state: OrderState): number => state.order.deadline + state.extension;
    // A trip is burger-fast if it starts while a burger is in effect
    const hasBurger = (driver: DriverState, start: number): boolean =>
        driver.burgers.some((b) => b <= start && start < b + POWERUPS.big_belly_burger.minutes);

    // Returns an error message if the command is invalid, otherwise applies it
    const applyCommand = (driver: DriverState, cmd: Command): string | null => {
        if (cmd.t < driver.t) {
            return `${cmd.cmd} at t=${cmd.t} is earlier than the previous command at t=${driver.t}`;
        }
        if (cmd.t > world.shift_end) {
            return `${cmd.cmd} at t=${cmd.t} is after shift_end=${world.shift_end}`;
        }

        if (cmd.cmd === "go") {
            const travel = getTravelTimes(world, driver.driverClass, hasBurger(driver, driver.t));
            const minutes = travel.between(driver.node, cmd.to);
            if (minutes === null) {
                return `go to ${cmd.to}: no path from ${driver.node} this driver can use`;
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
                if (driver.node !== order.target) {
                    return `pickup ${order.id} at ${driver.node}, but its target is ${order.target}`;
                }
                if (cmd.t < order.ready_at) {
                    return `pickup ${order.id} at t=${cmd.t}, but the jewelry isn't ready until t=${order.ready_at}`;
                }
                if (state.stolenBy !== null) {
                    return `pickup ${order.id}, but it was already stolen by ${state.stolenBy}`;
                }
                if (driver.carrying.size >= driver.capacity) {
                    return `pickup ${order.id}, but the satchel is full (${driver.capacity}/${driver.capacity})`;
                }
                state.stolenBy = driver.id;
                driver.carrying.add(order.id);
            } else {
                if (!driver.carrying.has(order.id)) {
                    return `dropoff ${order.id}, but this driver isn't carrying it`;
                }
                if (driver.node !== order.fence) {
                    return `dropoff ${order.id} at ${driver.node}, but its fence is ${order.fence}`;
                }
                driver.carrying.delete(order.id);
                state.deliveredAt = cmd.t;
                if (world.powerups_enabled) {
                    coinsEarned += orderCoins(cmd.t, deadlineOf(state));
                }
            }
        }

        driver.t = cmd.t;
        return null;
    };

    // Returns an error message if the power-up is skipped, otherwise buys and activates it
    const applyPowerup = (powerup: Powerup): string | null => {
        if (powerup.t > world.shift_end) {
            return `${powerup.type} at t=${powerup.t} is after shift_end=${world.shift_end}`;
        }
        const { cost } = POWERUPS[powerup.type];
        const balance = coinsEarned - coinsSpent;
        if (balance < cost) {
            return `${powerup.type} at t=${powerup.t} costs ${cost} coins, only ${balance} available`;
        }
        if (powerup.type === "cactus_cocktail") {
            const state = orders.get(powerup.order)!;
            if (state.deliveredAt !== null) {
                return `cactus_cocktail for ${powerup.order} at t=${powerup.t}, but it was already delivered at t=${state.deliveredAt}`;
            }
            state.extension += POWERUPS.cactus_cocktail.extraMinutes;
        } else {
            const driver = driversById.get(powerup.driver)!;
            if (powerup.type === "big_belly_burger") {
                driver.burgers.push(powerup.t);
            } else {
                driver.capacity += POWERUPS.extra_satchel.extraCapacity;
            }
        }
        coinsSpent += cost;
        return null;
    };

    const runNext = (driver: DriverState): void => {
        const index = driver.next;
        driver.next += 1;
        const message = applyCommand(driver, driver.commands[index]!);
        if (message !== null) {
            driver.cut = true;
            errors.push({ driver: driver.id, index, message: `${driver.id}[${index}]: ${message}` });
        }
    };
    const head = (driver: DriverState): Command | null =>
        driver.cut || driver.next >= driver.commands.length ? null : driver.commands[driver.next]!;

    // Replay minute by minute. Within a minute: dropoffs first, then power-ups, then everything else.
    // A driver's own commands always run in the order they were written, so "dropoffs first" runs each
    // driver's commands up to their last dropoff that minute (a trip to the fence has to come first).
    const minutes = [
        ...new Set([...drivers.flatMap((d) => d.commands.map((c) => c.t)), ...powerupQueue.map((p) => p.powerup.t)]),
    ].sort((a, b) => a - b);
    for (const minute of minutes) {
        // Commands whose t went backwards were skipped over by earlier minutes; they fail as soon as they're reached
        for (const driver of drivers) {
            for (let cmd = head(driver); cmd !== null && cmd.t < minute; cmd = head(driver)) {
                runNext(driver);
            }
        }
        // 1. Dropoffs
        for (const driver of drivers) {
            let lastDropoff = -1;
            for (let i = driver.next; i < driver.commands.length && driver.commands[i]!.t === minute; i++) {
                if (driver.commands[i]!.cmd === "dropoff") {
                    lastDropoff = i;
                }
            }
            while (head(driver) !== null && driver.next <= lastDropoff) {
                runNext(driver);
            }
        }
        // 2. Power-ups
        while (nextPowerup < powerupQueue.length && powerupQueue[nextPowerup]!.powerup.t === minute) {
            const { powerup, index } = powerupQueue[nextPowerup]!;
            nextPowerup += 1;
            const message = applyPowerup(powerup);
            if (message !== null) {
                powerupErrors.push({ index, message: `powerups[${index}]: ${message}` });
            }
        }
        // 3. Everything else, in driver order
        for (const driver of drivers) {
            for (let cmd = head(driver); cmd !== null && cmd.t === minute; cmd = head(driver)) {
                runNext(driver);
            }
        }
    }
    // Anything left has a t that went backwards after the last minute; it fails when reached
    for (const driver of drivers) {
        while (head(driver) !== null) {
            runNext(driver);
        }
    }

    let score = 0;
    let completed = 0;
    let onTime = 0;
    let lateMinutes = 0;
    for (const state of orders.values()) {
        if (state.deliveredAt === null) {
            continue;
        }
        completed += 1;
        const deadline = deadlineOf(state);
        const late = Math.max(0, state.deliveredAt - deadline);
        if (late === 0) {
            onTime += 1;
        }
        lateMinutes += late;
        score += orderPoints(state.deliveredAt, deadline);
    }

    return {
        instance: world.instance,
        score,
        totalOrders: world.orders.length,
        completed,
        onTime,
        lateMinutes,
        travelMinutes,
        errors,
        coinsEarned,
        coinsSpent,
        powerupErrors,
    };
}
