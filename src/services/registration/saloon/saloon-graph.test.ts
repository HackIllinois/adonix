import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "fs";
import path from "path";
import { MERCENARY_CLASSES, connectionTravelMinutes, TravelTimes } from "./saloon-graph";
import { parseWorld, World } from "./saloon-schemas";

function loadSampleWorld(): World {
    return parseWorld(JSON.parse(readFileSync(path.join(__dirname, "__fixtures__", "tier1-sample.world.json"), "utf8")));
}

describe("connectionTravelMinutes", () => {
    it("computes ceil(length / speed * crowd)", () => {
        expect(connectionTravelMinutes({ length: 4, crowd: 2.0, tags: [] }, MERCENARY_CLASSES.pickpocket)).toBe(4);
        expect(connectionTravelMinutes({ length: 1, crowd: 1.0, tags: [] }, MERCENARY_CLASSES.pickpocket)).toBe(1); // 0.5 rounds up
        expect(connectionTravelMinutes({ length: 9, crowd: 1.3, tags: [] }, MERCENARY_CLASSES.heavy_lifter)).toBe(8); // 7.8
    });

    it("uses exact integer math where floats would round wrong", () => {
        // 3 / 2.0 * 1.3 = 1.95 and 10 / 2.0 * 1.2 = 6 exactly (floats give 6.000000000000001)
        expect(connectionTravelMinutes({ length: 3, crowd: 1.3, tags: [] }, MERCENARY_CLASSES.pickpocket)).toBe(2);
        expect(connectionTravelMinutes({ length: 10, crowd: 1.2, tags: [] }, MERCENARY_CLASSES.pickpocket)).toBe(6);
    });

    it("lets disguisers ignore crowds", () => {
        expect(connectionTravelMinutes({ length: 4, crowd: 2.0, tags: [] }, MERCENARY_CLASSES.disguiser)).toBe(4);
    });

    it("blocks connections a class can't use", () => {
        expect(connectionTravelMinutes({ length: 4, crowd: 1, tags: ["main_floor"] }, MERCENARY_CLASSES.disguiser)).toBeNull();
        expect(connectionTravelMinutes({ length: 4, crowd: 1, tags: ["crawlspace"] }, MERCENARY_CLASSES.heavy_lifter)).toBeNull();
        expect(
            connectionTravelMinutes({ length: 4, crowd: 1, tags: ["crawlspace", "main_floor"] }, MERCENARY_CLASSES.pickpocket),
        ).toBe(2);
    });
});

describe("TravelTimes", () => {
    it("finds shortest paths for a pickpocket", () => {
        const times = TravelTimes.build(loadSampleWorld(), MERCENARY_CLASSES.pickpocket);
        expect(times.between("HQ", "HQ")).toBe(0);
        expect(times.between("HQ", "T1")).toBe(5); // HQ-W1-T1 = 2 + 3
        expect(times.between("B1", "T2")).toBe(4); // B1-B2-T2 = 2 + 2
        expect(times.between("T2", "HQ")).toBe(6); // T2-W1-HQ = 4 + 2
        expect(times.between("T1", "HQ")).toBe(times.between("HQ", "T1")); // undirected
    });

    it("routes around connections a class can't use", () => {
        const world = loadSampleWorld();
        // A heavy lifter can't squeeze through the W1-T2 crawlspace: best is HQ-W1-T1-B2-T2 = 3 + 4 + 6 + 3,
        // beating the main floor route HQ-B3-T2 = 20 + 6
        const heavyLifter = TravelTimes.build(world, MERCENARY_CLASSES.heavy_lifter);
        expect(heavyLifter.between("HQ", "T2")).toBe(16);
        // A disguiser stays off the HQ-B3 main floor and ignores crowds: HQ-W1-T2-B3 = 4 + 4 + 8
        const disguiser = TravelTimes.build(world, MERCENARY_CLASSES.disguiser);
        expect(disguiser.between("HQ", "B3")).toBe(16);
    });

    it("returns null for unreachable or unknown spots", () => {
        const world: World = {
            ...loadSampleWorld(),
            nodes: [...loadSampleWorld().nodes, { id: "CELLAR", type: "back_room" }],
        };
        const times = TravelTimes.build(world, MERCENARY_CLASSES.pickpocket);
        expect(times.between("HQ", "CELLAR")).toBeNull();
        expect(times.between("HQ", "NOPE")).toBeNull();
    });
});
