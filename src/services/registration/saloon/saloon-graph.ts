// Shortest-path travel times for each mercenary class. Integer math only, so every run gives the same minutes.
import { ConnectionTag, MercenaryClass, World } from "./saloon-schemas";

export interface MercenaryClassSpec {
    // Speed in hundredths of a pace per minute, so a Big Belly Burger (x1.5) stays an integer for every class
    speedHundredths: number;
    // Satchel size: how many cash bags the mercenary can carry at once
    capacity: number;
    ignoresCrowd: boolean;
    forbiddenTag: ConnectionTag | null;
}

export const MERCENARY_CLASSES: Record<MercenaryClass, MercenaryClassSpec> = {
    // Blends in with the drinkers, but would be recognized in the light of the main floor
    disguiser: { speedHundredths: 100, capacity: 2, ignoresCrowd: true, forbiddenTag: "main_floor" },
    pickpocket: { speedHundredths: 200, capacity: 4, ignoresCrowd: false, forbiddenTag: null },
    // Too big to fit through a crawlspace
    heavy_lifter: { speedHundredths: 150, capacity: 8, ignoresCrowd: false, forbiddenTag: "crawlspace" },
};

const CROWD_TENTHS = 10;
// length [paces] * crowd [tenths] * 10 / speed [hundredths] = minutes
const UNIT_SCALE = 10;

function ceilDiv(numerator: number, denominator: number): number {
    return Math.floor((numerator + denominator - 1) / denominator);
}

/** Minutes to cross one connection, or null if the class can't use it. `ceil(length / speed * crowd)`. */
export function connectionTravelMinutes(
    connection: { length: number; crowd: number; tags: ConnectionTag[] },
    spec: MercenaryClassSpec,
): number | null {
    if (spec.forbiddenTag && connection.tags.includes(spec.forbiddenTag)) {
        return null;
    }
    const crowdTenths = spec.ignoresCrowd ? CROWD_TENTHS : Math.round(connection.crowd * CROWD_TENTHS);
    return ceilDiv(connection.length * crowdTenths * UNIT_SCALE, spec.speedHundredths);
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

/** Lazily computed all-pairs shortest travel times for one mercenary class on one floor plan. */
export class TravelTimes {
    private readonly fromCache = new Map<number, Float64Array>();

    private constructor(
        private readonly index: Map<string, number>,
        private readonly adjacency: Neighbor[][],
    ) {}

    static build(world: World, spec: MercenaryClassSpec): TravelTimes {
        const index = new Map<string, number>();
        world.nodes.forEach((node, i) => index.set(node.id, i));
        const adjacency: Neighbor[][] = world.nodes.map(() => []);
        for (const connection of world.connections) {
            const minutes = connectionTravelMinutes(connection, spec);
            if (minutes === null) {
                continue;
            }
            const a = index.get(connection.a)!;
            const b = index.get(connection.b)!;
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

const travelTimesCache = new WeakMap<World, Map<MercenaryClass, TravelTimes>>();

/** Travel times for a class on a floor plan, cached per world object (worlds are cached by challenge-lib). */
export function getTravelTimes(world: World, mercenaryClass: MercenaryClass): TravelTimes {
    let byClass = travelTimesCache.get(world);
    if (!byClass) {
        byClass = new Map();
        travelTimesCache.set(world, byClass);
    }
    let times = byClass.get(mercenaryClass);
    if (!times) {
        times = TravelTimes.build(world, MERCENARY_CLASSES[mercenaryClass]);
        byClass.set(mercenaryClass, times);
    }
    return times;
}
