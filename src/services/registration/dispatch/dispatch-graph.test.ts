import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "fs";
import path from "path";
import { DRIVER_CLASSES, edgeTravelMinutes, TravelTimes } from "./dispatch-graph";
import { parseWorld, World } from "./dispatch-schemas";

function loadSampleWorld(): World {
    return parseWorld(JSON.parse(readFileSync(path.join(__dirname, "__fixtures__", "tier1-sample.world.json"), "utf8")));
}

describe("edgeTravelMinutes", () => {
    it("computes ceil(length / speed * congestion)", () => {
        expect(edgeTravelMinutes({ length: 4, congestion: 2.0, tags: [] }, DRIVER_CLASSES.car)).toBe(4);
        expect(edgeTravelMinutes({ length: 1, congestion: 1.0, tags: [] }, DRIVER_CLASSES.car)).toBe(1); // 0.5 rounds up
        expect(edgeTravelMinutes({ length: 9, congestion: 1.3, tags: [] }, DRIVER_CLASSES.truck)).toBe(8); // 7.8
    });

    it("uses exact integer math where floats would round wrong", () => {
        // 3 / 2.0 * 1.3 = 1.95 and 10 / 2.0 * 1.2 = 6 exactly (floats give 6.000000000000001)
        expect(edgeTravelMinutes({ length: 3, congestion: 1.3, tags: [] }, DRIVER_CLASSES.car)).toBe(2);
        expect(edgeTravelMinutes({ length: 10, congestion: 1.2, tags: [] }, DRIVER_CLASSES.car)).toBe(6);
    });

    it("lets bikes ignore congestion", () => {
        expect(edgeTravelMinutes({ length: 4, congestion: 2.0, tags: [] }, DRIVER_CLASSES.bike)).toBe(4);
    });

    it("blocks edges a class can't use", () => {
        expect(edgeTravelMinutes({ length: 4, congestion: 1, tags: ["highway"] }, DRIVER_CLASSES.bike)).toBeNull();
        expect(edgeTravelMinutes({ length: 4, congestion: 1, tags: ["narrow"] }, DRIVER_CLASSES.truck)).toBeNull();
        expect(edgeTravelMinutes({ length: 4, congestion: 1, tags: ["narrow", "highway"] }, DRIVER_CLASSES.car)).toBe(2);
    });
});

describe("TravelTimes", () => {
    it("finds shortest paths for a car", () => {
        const times = TravelTimes.build(loadSampleWorld(), DRIVER_CLASSES.car);
        expect(times.between("D0", "D0")).toBe(0);
        expect(times.between("D0", "R1")).toBe(5); // D0-X1-R1 = 2 + 3
        expect(times.between("H1", "R2")).toBe(4); // H1-H2-R2 = 2 + 2
        expect(times.between("R2", "D0")).toBe(6); // R2-X1-D0 = 4 + 2
        expect(times.between("R1", "D0")).toBe(times.between("D0", "R1")); // undirected
    });

    it("routes around edges a class can't use", () => {
        const world = loadSampleWorld();
        // Truck can't use narrow X1-R2: best is D0-X1-R1-H2-R2 = 3 + 4 + 6 + 3, beating highway D0-H3-R2 = 20 + 6
        const truck = TravelTimes.build(world, DRIVER_CLASSES.truck);
        expect(truck.between("D0", "R2")).toBe(16);
        // Bike can't use the D0-H3 highway and ignores congestion: D0-X1-R2-H3 = 4 + 4 + 8
        const bike = TravelTimes.build(world, DRIVER_CLASSES.bike);
        expect(bike.between("D0", "H3")).toBe(16);
    });

    it("returns null for unreachable or unknown nodes", () => {
        const world: World = {
            ...loadSampleWorld(),
            nodes: [...loadSampleWorld().nodes, { id: "ISLAND", type: "house" }],
        };
        const times = TravelTimes.build(world, DRIVER_CLASSES.car);
        expect(times.between("D0", "ISLAND")).toBeNull();
        expect(times.between("D0", "NOPE")).toBeNull();
    });
});
