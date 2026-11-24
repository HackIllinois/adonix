import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "fs";
import path from "path";
import { DRIVER_CLASSES, edgeTravelMinutes, TravelTimes } from "./saloon-graph";
import { parseWorld, World } from "./saloon-schemas";

function loadSampleWorld(): World {
    return parseWorld(JSON.parse(readFileSync(path.join(__dirname, "__fixtures__", "tier1-sample.world.json"), "utf8")));
}

describe("edgeTravelMinutes", () => {
    it("computes ceil(length / speed * congestion)", () => {
        expect(edgeTravelMinutes({ length: 4, congestion: 2.0, tags: [] }, DRIVER_CLASSES.speedster)).toBe(4);
        expect(edgeTravelMinutes({ length: 1, congestion: 1.0, tags: [] }, DRIVER_CLASSES.speedster)).toBe(1); // 0.5 rounds up
        expect(edgeTravelMinutes({ length: 9, congestion: 1.3, tags: [] }, DRIVER_CLASSES.hauler)).toBe(8); // 7.8
    });

    it("uses exact integer math where floats would round wrong", () => {
        // 3 / 2.0 * 1.3 = 1.95 and 10 / 2.0 * 1.2 = 6 exactly (floats give 6.000000000000001)
        expect(edgeTravelMinutes({ length: 3, congestion: 1.3, tags: [] }, DRIVER_CLASSES.speedster)).toBe(2);
        expect(edgeTravelMinutes({ length: 10, congestion: 1.2, tags: [] }, DRIVER_CLASSES.speedster)).toBe(6);
    });

    it("lets disguisers ignore congestion", () => {
        expect(edgeTravelMinutes({ length: 4, congestion: 2.0, tags: [] }, DRIVER_CLASSES.disguiser)).toBe(4);
    });

    it("blocks edges a class can't use", () => {
        expect(edgeTravelMinutes({ length: 4, congestion: 1, tags: ["exposed"] }, DRIVER_CLASSES.disguiser)).toBeNull();
        expect(edgeTravelMinutes({ length: 4, congestion: 1, tags: ["narrow"] }, DRIVER_CLASSES.hauler)).toBeNull();
        expect(edgeTravelMinutes({ length: 4, congestion: 1, tags: ["narrow", "exposed"] }, DRIVER_CLASSES.speedster)).toBe(2);
    });
});

describe("TravelTimes", () => {
    it("finds shortest paths for a speedster", () => {
        const times = TravelTimes.build(loadSampleWorld(), DRIVER_CLASSES.speedster);
        expect(times.between("S0", "S0")).toBe(0);
        expect(times.between("S0", "T1")).toBe(5); // S0-X1-T1 = 2 + 3
        expect(times.between("F1", "T2")).toBe(4); // F1-F2-T2 = 2 + 2
        expect(times.between("T2", "S0")).toBe(6); // T2-X1-S0 = 4 + 2
        expect(times.between("T1", "S0")).toBe(times.between("S0", "T1")); // undirected
    });

    it("routes around edges a class can't use", () => {
        const world = loadSampleWorld();
        // A hauler can't squeeze through the X1-T2 narrow passage: best is S0-X1-T1-F2-T2 = 3 + 4 + 6 + 3,
        // beating the exposed passage route S0-F3-T2 = 20 + 6
        const hauler = TravelTimes.build(world, DRIVER_CLASSES.hauler);
        expect(hauler.between("S0", "T2")).toBe(16);
        // A disguiser stays off the S0-F3 exposed passage and ignores congestion: S0-X1-T2-F3 = 4 + 4 + 8
        const disguiser = TravelTimes.build(world, DRIVER_CLASSES.disguiser);
        expect(disguiser.between("S0", "F3")).toBe(16);
    });

    it("returns null for unreachable or unknown nodes", () => {
        const world: World = {
            ...loadSampleWorld(),
            nodes: [...loadSampleWorld().nodes, { id: "CELLAR", type: "fence" }],
        };
        const times = TravelTimes.build(world, DRIVER_CLASSES.speedster);
        expect(times.between("S0", "CELLAR")).toBeNull();
        expect(times.between("S0", "NOPE")).toBeNull();
    });
});
