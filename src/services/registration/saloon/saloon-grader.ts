// Deterministic replay and scoring of a Saloon Rush plan.
import { MERCENARY_CLASSES, getTravelTimes } from "./saloon-graph";
import { Command, GradeReport, InvalidPlanError, Plan, RouteError, World, WorldContract } from "./saloon-schemas";

export const SCORING = {
    POINTS_PER_CONTRACT: 100,
    PENALTY_PER_LATE_MINUTE: 5,
    MIN_POINTS_PER_CONTRACT: 20,
} as const;

// When commands from different mercenaries share a minute: dropoffs first, then bar orders, then everything else
const DROPOFF_PRIORITY = 0;
const OTHER_PRIORITY = 2;

function commandPriority(cmd: Command): number {
    return cmd.cmd === "dropoff" ? DROPOFF_PRIORITY : OTHER_PRIORITY;
}

/** Points for one completed contract: 100, minus 5 per minute late, never below 20. */
export function contractPoints(dropoffT: number, deadline: number): number {
    const late = Math.max(0, dropoffT - deadline);
    return Math.max(SCORING.MIN_POINTS_PER_CONTRACT, SCORING.POINTS_PER_CONTRACT - SCORING.PENALTY_PER_LATE_MINUTE * late);
}

interface MercenaryState {
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

interface ContractState {
    contract: WorldContract;
    liftedBy: string | null;
    completedAt: number | null;
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
}

/**
 * Replays a plan against a floor plan and scores it.
 * Throws InvalidPlanError for a broken file. An invalid command only cuts the rest of that mercenary's route.
 */
export function gradePlan(world: World, plan: Plan): GradeReport {
    checkPlanReferences(world, plan);

    const contracts = new Map<string, ContractState>(
        world.contracts.map((contract) => [contract.id, { contract, liftedBy: null, completedAt: null }]),
    );
    const mercenaries: MercenaryState[] = world.mercenaries.map((mercenary) => ({
        id: mercenary.id,
        commands: plan.routes[mercenary.id] ?? [],
        next: 0,
        cut: false,
        node: mercenary.hideout,
        t: 0,
        carrying: new Set(),
        capacity: MERCENARY_CLASSES[mercenary.class].capacity,
        travel: getTravelTimes(world, mercenary.class),
    }));

    const errors: RouteError[] = [];
    let travelMinutes = 0;

    // Returns an error message if the command is invalid, otherwise applies it
    const apply = (mercenary: MercenaryState, cmd: Command): string | null => {
        if (cmd.t < mercenary.t) {
            return `${cmd.cmd} at t=${cmd.t} is earlier than the previous command at t=${mercenary.t}`;
        }
        if (cmd.t > world.shift_end) {
            return `${cmd.cmd} at t=${cmd.t} is after shift_end=${world.shift_end}`;
        }

        if (cmd.cmd === "go") {
            const minutes = mercenary.travel.between(mercenary.node, cmd.to);
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
            }
        }

        mercenary.t = cmd.t;
        return null;
    };

    // Merge every mercenary's queue by (t, priority, crew order). Only queue heads are compared,
    // so each mercenary's own commands always run in the order they were written.
    for (;;) {
        let chosen: MercenaryState | null = null;
        for (const mercenary of mercenaries) {
            if (mercenary.cut || mercenary.next >= mercenary.commands.length) {
                continue;
            }
            if (!chosen) {
                chosen = mercenary;
                continue;
            }
            const a = mercenary.commands[mercenary.next]!;
            const b = chosen.commands[chosen.next]!;
            if (a.t < b.t || (a.t === b.t && commandPriority(a) < commandPriority(b))) {
                chosen = mercenary;
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
            errors.push({ mercenary: chosen.id, index, message: `${chosen.id}[${index}]: ${message}` });
        }
    }

    let score = 0;
    let completed = 0;
    let onTime = 0;
    let lateMinutes = 0;
    for (const { contract, completedAt } of contracts.values()) {
        if (completedAt === null) {
            continue;
        }
        completed += 1;
        const late = Math.max(0, completedAt - contract.deadline);
        if (late === 0) {
            onTime += 1;
        }
        lateMinutes += late;
        score += contractPoints(completedAt, contract.deadline);
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
    };
}
