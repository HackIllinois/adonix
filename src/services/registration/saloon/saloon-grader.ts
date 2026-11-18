// Deterministic replay and scoring of a Saloon Rush plan.
import { MERCENARY_CLASSES, getTravelTimes } from "./saloon-graph";
import {
    BarError,
    BarOrder,
    Command,
    GradeReport,
    InvalidPlanError,
    MercenaryClass,
    Plan,
    RouteError,
    World,
    WorldContract,
} from "./saloon-schemas";

export const SCORING = {
    POINTS_PER_CONTRACT: 100,
    PENALTY_PER_LATE_MINUTE: 5,
    MIN_POINTS_PER_CONTRACT: 20,
} as const;

// Tier 3: dealers tip in coins for bags delivered on time, and coins buy from the bar menu
export const COINS = {
    ON_TIME: 50,
    EARLY: 100,
    EARLY_MINUTES: 10,
} as const;

export const BAR_MENU = {
    // The dealer gets drunk and pushes back one contract's deadline
    beer: { cost: 150, extraMinutes: 15 },
    // One mercenary walks 1.5x faster for a while
    big_belly_burger: { cost: 300, minutes: 30 },
    // One mercenary carries 2 more bags for the rest of the night
    backpack: { cost: 400, extraCapacity: 2 },
} as const;

export const BAR_CLOSED_MESSAGE = "bar orders aren't on the menu in this tier";

/** Points for one completed contract: 100, minus 5 per minute late, never below 20. */
export function contractPoints(dropoffT: number, deadline: number): number {
    const late = Math.max(0, dropoffT - deadline);
    return Math.max(SCORING.MIN_POINTS_PER_CONTRACT, SCORING.POINTS_PER_CONTRACT - SCORING.PENALTY_PER_LATE_MINUTE * late);
}

/** Coins for one dropoff: 100 if at least 10 minutes early, 50 if on time, otherwise none. */
export function contractCoins(dropoffT: number, deadline: number): number {
    if (dropoffT > deadline) {
        return 0;
    }
    return deadline - dropoffT >= COINS.EARLY_MINUTES ? COINS.EARLY : COINS.ON_TIME;
}

interface MercenaryState {
    id: string;
    mercenaryClass: MercenaryClass;
    commands: Command[];
    next: number;
    cut: boolean;
    node: string;
    t: number;
    carrying: Set<string>;
    capacity: number;
    // Minutes when this mercenary ate a Big Belly Burger
    burgers: number[];
}

interface ContractState {
    contract: WorldContract;
    liftedBy: string | null;
    completedAt: number | null;
    // Extra minutes from beers
    extension: number;
}

/** Rejects plans that can't be graded at all, before any replay. */
function checkPlanReferences(world: World, plan: Plan): void {
    if (plan.instance !== world.instance) {
        throw new InvalidPlanError(`plan.instance is "${plan.instance}", but your floor plan is "${world.instance}"`);
    }
    const mercenaryIds = new Set(world.mercenaries.map((m) => m.id));
    const nodeIds = new Set(world.nodes.map((n) => n.id));
    const contractIds = new Set(world.contracts.map((c) => c.id));

    for (const [mercenaryId, commands] of Object.entries(plan.routes)) {
        if (!mercenaryIds.has(mercenaryId)) {
            throw new InvalidPlanError(`routes has unknown mercenary "${mercenaryId}"`);
        }
        commands.forEach((cmd, i) => {
            if (cmd.cmd === "go" && !nodeIds.has(cmd.to)) {
                throw new InvalidPlanError(`${mercenaryId}[${i}]: unknown spot "${cmd.to}"`);
            }
            if (cmd.cmd !== "go" && !contractIds.has(cmd.contract)) {
                throw new InvalidPlanError(`${mercenaryId}[${i}]: unknown contract "${cmd.contract}"`);
            }
        });
    }

    const barOrders = plan.bar_orders ?? [];
    if (barOrders.length > 0 && !world.bar_open) {
        throw new InvalidPlanError(BAR_CLOSED_MESSAGE);
    }
    barOrders.forEach((order, i) => {
        if (order.item === "beer") {
            if (!contractIds.has(order.contract)) {
                throw new InvalidPlanError(`bar_orders[${i}]: unknown contract "${order.contract}"`);
            }
        } else if (!mercenaryIds.has(order.mercenary)) {
            throw new InvalidPlanError(`bar_orders[${i}]: unknown mercenary "${order.mercenary}"`);
        }
    });
}

/**
 * Replays a plan against a floor plan and scores it.
 * Throws InvalidPlanError for a broken file. An invalid command only cuts the rest of that mercenary's route,
 * and a bar order that can't be served is skipped.
 */
export function gradePlan(world: World, plan: Plan): GradeReport {
    checkPlanReferences(world, plan);

    const contracts = new Map<string, ContractState>(
        world.contracts.map((contract) => [contract.id, { contract, liftedBy: null, completedAt: null, extension: 0 }]),
    );
    const mercenaries: MercenaryState[] = world.mercenaries.map((mercenary) => ({
        id: mercenary.id,
        mercenaryClass: mercenary.class,
        commands: plan.routes[mercenary.id] ?? [],
        next: 0,
        cut: false,
        node: mercenary.hideout,
        t: 0,
        carrying: new Set(),
        capacity: MERCENARY_CLASSES[mercenary.class].capacity,
        burgers: [],
    }));
    const mercenariesById = new Map(mercenaries.map((m) => [m.id, m]));
    // Bar orders are served in time order; ties keep their order in the file
    const barQueue = (plan.bar_orders ?? [])
        .map((order, index) => ({ order, index }))
        .sort((a, b) => a.order.t - b.order.t || a.index - b.index);
    let nextBarOrder = 0;

    const errors: RouteError[] = [];
    const barErrors: BarError[] = [];
    let travelMinutes = 0;
    // Coins only matter while the bar is open (Tier 3), so they stay at 0 everywhere else
    let coinsEarned = world.bar_open ? world.coins : 0;
    let coinsSpent = 0;

    const deadlineOf = (state: ContractState): number => state.contract.deadline + state.extension;
    // A walk is burger-fast if it starts while a burger is in effect
    const hasBurger = (mercenary: MercenaryState, start: number): boolean =>
        mercenary.burgers.some((b) => b <= start && start < b + BAR_MENU.big_belly_burger.minutes);

    // Returns an error message if the command is invalid, otherwise applies it
    const applyCommand = (mercenary: MercenaryState, cmd: Command): string | null => {
        if (cmd.t < mercenary.t) {
            return `${cmd.cmd} at t=${cmd.t} is earlier than the previous command at t=${mercenary.t}`;
        }
        if (cmd.t > world.shift_end) {
            return `${cmd.cmd} at t=${cmd.t} is after shift_end=${world.shift_end}`;
        }

        if (cmd.cmd === "go") {
            const travel = getTravelTimes(world, mercenary.mercenaryClass, hasBurger(mercenary, mercenary.t));
            const minutes = travel.between(mercenary.node, cmd.to);
            if (minutes === null) {
                return `go to ${cmd.to}: no path from ${mercenary.node} this mercenary can use`;
            }
            const earliest = mercenary.t + minutes;
            if (cmd.t < earliest) {
                return `go to ${cmd.to} at t=${cmd.t}, earliest possible t=${earliest}`;
            }
            mercenary.node = cmd.to;
            travelMinutes += minutes;
        } else {
            const state = contracts.get(cmd.contract)!;
            const { contract } = state;
            if (cmd.cmd === "pickup") {
                if (mercenary.node !== contract.table) {
                    return `pickup ${contract.id} at ${mercenary.node}, but its game table is ${contract.table}`;
                }
                if (cmd.t < contract.ready_at) {
                    return `pickup ${contract.id} at t=${cmd.t}, but the bag isn't ready until t=${contract.ready_at}`;
                }
                if (state.liftedBy !== null) {
                    return `pickup ${contract.id}, but it was already lifted by ${state.liftedBy}`;
                }
                if (mercenary.carrying.size >= mercenary.capacity) {
                    return `pickup ${contract.id}, but the satchel is full (${mercenary.capacity}/${mercenary.capacity})`;
                }
                state.liftedBy = mercenary.id;
                mercenary.carrying.add(contract.id);
            } else {
                if (!mercenary.carrying.has(contract.id)) {
                    return `dropoff ${contract.id}, but this mercenary isn't carrying it`;
                }
                if (mercenary.node !== contract.back_room) {
                    return `dropoff ${contract.id} at ${mercenary.node}, but its back room is ${contract.back_room}`;
                }
                mercenary.carrying.delete(contract.id);
                state.completedAt = cmd.t;
                if (world.bar_open) {
                    coinsEarned += contractCoins(cmd.t, deadlineOf(state));
                }
            }
        }

        mercenary.t = cmd.t;
        return null;
    };

    // Returns an error message if the bar order is skipped, otherwise buys and applies it
    const applyBarOrder = (order: BarOrder): string | null => {
        if (order.t > world.shift_end) {
            return `${order.item} at t=${order.t} is after shift_end=${world.shift_end}`;
        }
        const { cost } = BAR_MENU[order.item];
        const balance = coinsEarned - coinsSpent;
        if (balance < cost) {
            return `${order.item} at t=${order.t} costs ${cost} coins, only ${balance} available`;
        }
        if (order.item === "beer") {
            const state = contracts.get(order.contract)!;
            if (state.completedAt !== null) {
                return `beer for ${order.contract} at t=${order.t}, but it was already delivered at t=${state.completedAt}`;
            }
            state.extension += BAR_MENU.beer.extraMinutes;
        } else {
            const mercenary = mercenariesById.get(order.mercenary)!;
            if (order.item === "big_belly_burger") {
                mercenary.burgers.push(order.t);
            } else {
                mercenary.capacity += BAR_MENU.backpack.extraCapacity;
            }
        }
        coinsSpent += cost;
        return null;
    };

    const runNext = (mercenary: MercenaryState): void => {
        const index = mercenary.next;
        mercenary.next += 1;
        const message = applyCommand(mercenary, mercenary.commands[index]!);
        if (message !== null) {
            mercenary.cut = true;
            errors.push({ mercenary: mercenary.id, index, message: `${mercenary.id}[${index}]: ${message}` });
        }
    };
    const head = (mercenary: MercenaryState): Command | null =>
        mercenary.cut || mercenary.next >= mercenary.commands.length ? null : mercenary.commands[mercenary.next]!;

    // Replay minute by minute. Within a minute: dropoffs first, then bar orders, then everything else.
    // A mercenary's own commands always run in the order they were written, so "dropoffs first" runs each
    // mercenary's commands up to their last dropoff that minute (a walk to the back room has to come first).
    const minutes = [
        ...new Set([...mercenaries.flatMap((m) => m.commands.map((c) => c.t)), ...barQueue.map((b) => b.order.t)]),
    ].sort((a, b) => a - b);
    for (const minute of minutes) {
        // Commands whose t went backwards were skipped over by earlier minutes; they fail as soon as they're reached
        for (const mercenary of mercenaries) {
            for (let cmd = head(mercenary); cmd !== null && cmd.t < minute; cmd = head(mercenary)) {
                runNext(mercenary);
            }
        }
        // 1. Dropoffs
        for (const mercenary of mercenaries) {
            let lastDropoff = -1;
            for (let i = mercenary.next; i < mercenary.commands.length && mercenary.commands[i]!.t === minute; i++) {
                if (mercenary.commands[i]!.cmd === "dropoff") {
                    lastDropoff = i;
                }
            }
            while (head(mercenary) !== null && mercenary.next <= lastDropoff) {
                runNext(mercenary);
            }
        }
        // 2. Bar orders
        while (nextBarOrder < barQueue.length && barQueue[nextBarOrder]!.order.t === minute) {
            const { order, index } = barQueue[nextBarOrder]!;
            nextBarOrder += 1;
            const message = applyBarOrder(order);
            if (message !== null) {
                barErrors.push({ index, message: `bar_orders[${index}]: ${message}` });
            }
        }
        // 3. Everything else, in crew order
        for (const mercenary of mercenaries) {
            for (let cmd = head(mercenary); cmd !== null && cmd.t === minute; cmd = head(mercenary)) {
                runNext(mercenary);
            }
        }
    }
    // Anything left has a t that went backwards after the last minute; it fails when reached
    for (const mercenary of mercenaries) {
        while (head(mercenary) !== null) {
            runNext(mercenary);
        }
    }

    let score = 0;
    let completed = 0;
    let onTime = 0;
    let lateMinutes = 0;
    for (const state of contracts.values()) {
        if (state.completedAt === null) {
            continue;
        }
        completed += 1;
        const deadline = deadlineOf(state);
        const late = Math.max(0, state.completedAt - deadline);
        if (late === 0) {
            onTime += 1;
        }
        lateMinutes += late;
        score += contractPoints(state.completedAt, deadline);
    }

    return {
        instance: world.instance,
        score,
        totalContracts: world.contracts.length,
        completed,
        onTime,
        lateMinutes,
        travelMinutes,
        errors,
        coinsEarned,
        coinsSpent,
        barErrors,
    };
}
