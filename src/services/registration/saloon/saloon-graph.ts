// Shortest-path travel times for each driver class. Integer math only, so every run gives the same minutes.
import { DriverClass, EdgeTag, World } from "./saloon-schemas";

export interface DriverClassSpec {
    // Speed in hundredths of a block per minute, so a Big Belly Burger (x1.5) stays an integer for every class
    speedHundredths: number;
    // Capacity: how many pieces of jewelry the driver can carry at once
    capacity: number;
    ignoresCongestion: boolean;
    forbiddenTag: EdgeTag | null;
}

export const DRIVER_CLASSES: Record<DriverClass, DriverClassSpec> = {
    // Blends into the crowd, but would be recognized in an exposed passage
    disguiser: { speedHundredths: 100, capacity: 2, ignoresCongestion: true, forbiddenTag: "exposed" },
    speedster: { speedHundredths: 200, capacity: 4, ignoresCongestion: false, forbiddenTag: null },
    // Too big to fit through a narrow passage
    hauler: { speedHundredths: 150, capacity: 8, ignoresCongestion: false, forbiddenTag: "narrow" },
};

// A Big Belly Burger multiplies speed by 3/2 (a whole number of hundredths for every class)
const BURGER_NUMERATOR = 3;
const BURGER_DENOMINATOR = 2;

export function burgerSpec(spec: DriverClassSpec): DriverClassSpec {
    return { ...spec, speedHundredths: (spec.speedHundredths * BURGER_NUMERATOR) / BURGER_DENOMINATOR };
}

const CONGESTION_TENTHS = 10;
// length [blocks] * congestion [tenths] * 10 / speed [hundredths] = minutes
const UNIT_SCALE = 10;

function ceilDiv(numerator: number, denominator: number): number {
    return Math.floor((numerator + denominator - 1) / denominator);
}

/** Minutes to cross one edge, or null if the class can't use it. `ceil(length / speed * congestion)`. */
export function edgeTravelMinutes(
    edge: { length: number; congestion: number; tags: EdgeTag[] },
    spec: DriverClassSpec,
): number | null {
    if (spec.forbiddenTag && edge.tags.includes(spec.forbiddenTag)) {
        return null;
    }
    const congestionTenths = spec.ignoresCongestion ? CONGESTION_TENTHS : Math.round(edge.congestion * CONGESTION_TENTHS);
    return ceilDiv(edge.length * congestionTenths * UNIT_SCALE, spec.speedHundredths);
}

interface Neighbor {
    to: number;
    minutes: number;
}

/** Minimal binary min-heap keyed on distance. */
class MinHeap {
    private items: [number, number][] = [];

    get size(): number {
        return this.items.length;
    }

    push(dist: number, node: number): void {
        const items = this.items;
        items.push([dist, node]);
        let i = items.length - 1;
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (items[parent]![0] <= items[i]![0]) {
                break;
            }
            [items[parent], items[i]] = [items[i]!, items[parent]!];
            i = parent;
        }
    }

    pop(): [number, number] {
        const items = this.items;
        const top = items[0]!;
        const last = items.pop()!;
        if (items.length > 0) {
            items[0] = last;
            let i = 0;
            for (;;) {
                const left = 2 * i + 1;
                const right = left + 1;
                let smallest = i;
                if (left < items.length && items[left]![0] < items[smallest]![0]) {
                    smallest = left;
                }
                if (right < items.length && items[right]![0] < items[smallest]![0]) {
                    smallest = right;
                }
                if (smallest === i) {
                    break;
                }
                [items[smallest], items[i]] = [items[i]!, items[smallest]!];
                i = smallest;
            }
        }
        return top;
    }
}

/** Lazily computed all-pairs shortest travel times for one driver class on one world. */
export class TravelTimes {
    private readonly fromCache = new Map<number, Float64Array>();

    private constructor(
        private readonly index: Map<string, number>,
        private readonly adjacency: Neighbor[][],
    ) {}

    static build(world: World, spec: DriverClassSpec): TravelTimes {
        const index = new Map<string, number>();
        world.nodes.forEach((node, i) => index.set(node.id, i));
        const adjacency: Neighbor[][] = world.nodes.map(() => []);
        for (const edge of world.edges) {
            const minutes = edgeTravelMinutes(edge, spec);
            if (minutes === null) {
                continue;
            }
            const a = index.get(edge.a)!;
            const b = index.get(edge.b)!;
            adjacency[a]!.push({ to: b, minutes });
            adjacency[b]!.push({ to: a, minutes });
        }
        return new TravelTimes(index, adjacency);
    }

    /** Shortest travel time in minutes, or null if `to` is unreachable (or either node is unknown). */
    between(from: string, to: string): number | null {
        const source = this.index.get(from);
        const target = this.index.get(to);
        if (source === undefined || target === undefined) {
            return null;
        }
        const dist = this.distancesFrom(source)[target]!;
        return Number.isFinite(dist) ? dist : null;
    }

    private distancesFrom(source: number): Float64Array {
        const cached = this.fromCache.get(source);
        if (cached) {
            return cached;
        }
        const dist = new Float64Array(this.adjacency.length).fill(Infinity);
        dist[source] = 0;
        const heap = new MinHeap();
        heap.push(0, source);
        while (heap.size > 0) {
            const [d, node] = heap.pop();
            if (d > dist[node]!) {
                continue;
            }
            for (const { to, minutes } of this.adjacency[node]!) {
                const next = d + minutes;
                if (next < dist[to]!) {
                    dist[to] = next;
                    heap.push(next, to);
                }
            }
        }
        this.fromCache.set(source, dist);
        return dist;
    }
}

const travelTimesCache = new WeakMap<World, Map<string, TravelTimes>>();

/**
 * Travel times for a class on a world, cached per world object (worlds are cached by challenge-lib).
 * `burger` gives the times for a driver who's eaten a Big Belly Burger.
 */
export function getTravelTimes(world: World, driverClass: DriverClass, burger = false): TravelTimes {
    let byKey = travelTimesCache.get(world);
    if (!byKey) {
        byKey = new Map();
        travelTimesCache.set(world, byKey);
    }
    const key = `${driverClass}:${burger}`;
    let times = byKey.get(key);
    if (!times) {
        const spec = DRIVER_CLASSES[driverClass];
        times = TravelTimes.build(world, burger ? burgerSpec(spec) : spec);
        byKey.set(key, times);
    }
    return times;
}
