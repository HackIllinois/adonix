import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "fs";
import path from "path";
import { deliveryPoints, gradePlan } from "./dispatch-grader";
import { Command, InvalidPlanError, parsePlan, parseWorld, Plan, World } from "./dispatch-schemas";

const FIXTURES = path.join(__dirname, "__fixtures__");

function loadSampleWorld(): World {
    return parseWorld(JSON.parse(readFileSync(path.join(FIXTURES, "tier1-sample.world.json"), "utf8")));
}

function loadSamplePlan(): Plan {
    return parsePlan(readFileSync(path.join(FIXTURES, "tier1-sample.plan.json"), "utf8"));
}

function carPlan(commands: Command[]): Plan {
    return { instance: "tier1-sample", routes: { "car-1": commands } };
}

// D0 -> R1 takes 5 minutes, R1 -> H1 takes 5 (direct) or 7 (via H2)
const TO_R1_PICK_O1: Command[] = [
    { t: 5, cmd: "go", to: "R1" },
    { t: 5, cmd: "pickup", order: "O1" },
];

describe("gradePlan", () => {
    it("scores the sample plan: all three on time", () => {
        expect(gradePlan(loadSampleWorld(), loadSamplePlan())).toEqual({
            instance: "tier1-sample",
            score: 300,
            totalOrders: 3,
            delivered: 3,
            onTime: 3,
            lateMinutes: 0,
            travelMinutes: 20,
            errors: [],
        });
    });

    it("is deterministic", () => {
        const world = loadSampleWorld();
        const plan = loadSamplePlan();
        expect(gradePlan(world, plan)).toEqual(gradePlan(world, plan));
    });

    it("scores an empty plan as zero", () => {
        const report = gradePlan(loadSampleWorld(), { instance: "tier1-sample", routes: {} });
        expect(report).toMatchObject({ score: 0, delivered: 0, errors: [] });
    });

    it("treats a later t as waiting", () => {
        const report = gradePlan(
            loadSampleWorld(),
            carPlan([
                { t: 9, cmd: "go", to: "R1" },
                { t: 9, cmd: "pickup", order: "O1" },
                { t: 15, cmd: "go", to: "H1" },
                { t: 15, cmd: "dropoff", order: "O1" },
            ]),
        );
        expect(report).toMatchObject({ score: 100, onTime: 1, travelMinutes: 10, errors: [] });
    });

    it("subtracts 5 points per late minute with a floor of 20", () => {
        expect(deliveryPoints(20, 20)).toBe(100);
        expect(deliveryPoints(10, 20)).toBe(100);
        expect(deliveryPoints(21, 20)).toBe(95);
        expect(deliveryPoints(36, 20)).toBe(20);
        expect(deliveryPoints(100, 20)).toBe(20);

        const report = gradePlan(
            loadSampleWorld(),
            carPlan([...TO_R1_PICK_O1, { t: 30, cmd: "go", to: "H1" }, { t: 30, cmd: "dropoff", order: "O1" }]),
        );
        expect(report).toMatchObject({ score: 50, delivered: 1, onTime: 0, lateMinutes: 10 });
    });

    it("scores an order picked up but never dropped off as zero", () => {
        const report = gradePlan(loadSampleWorld(), carPlan(TO_R1_PICK_O1));
        expect(report).toMatchObject({ score: 0, delivered: 0, errors: [] });
    });

    describe("invalid commands cut the route but keep earlier deliveries", () => {
        const deliverO1: Command[] = [...TO_R1_PICK_O1, { t: 10, cmd: "go", to: "H1" }, { t: 10, cmd: "dropoff", order: "O1" }];

        function expectCutAt(extra: Command[], message: string): void {
            const report = gradePlan(loadSampleWorld(), carPlan([...deliverO1, ...extra, { t: 119, cmd: "go", to: "D0" }]));
            expect(report.score).toBe(100);
            expect(report.delivered).toBe(1);
            expect(report.errors).toEqual([{ driver: "car-1", index: deliverO1.length, message }]);
        }

        it("go arriving too early", () => {
            expectCutAt([{ t: 13, cmd: "go", to: "R1" }], "car-1[4]: go to R1 at t=13, earliest possible t=15");
        });

        it("t going backwards", () => {
            expectCutAt([{ t: 9, cmd: "go", to: "H1" }], "car-1[4]: go at t=9 is earlier than the previous command at t=10");
        });

        it("t after shift_end", () => {
            expectCutAt([{ t: 121, cmd: "go", to: "R1" }], "car-1[4]: go at t=121 is after shift_end=120");
        });

        it("pickup at the wrong node", () => {
            expectCutAt([{ t: 10, cmd: "pickup", order: "O2" }], "car-1[4]: pickup O2 at H1, but its restaurant is R1");
        });

        it("pickup twice", () => {
            const report = gradePlan(
                loadSampleWorld(),
                carPlan([...deliverO1, { t: 15, cmd: "go", to: "R1" }, { t: 15, cmd: "pickup", order: "O1" }]),
            );
            expect(report.score).toBe(100);
            expect(report.errors).toEqual([
                { driver: "car-1", index: 5, message: "car-1[5]: pickup O1, but it was already picked up by car-1" },
            ]);
        });

        it("dropoff of an order the driver isn't carrying", () => {
            expectCutAt([{ t: 10, cmd: "dropoff", order: "O2" }], "car-1[4]: dropoff O2, but the driver is not carrying it");
        });

        it("dropoff at the wrong house", () => {
            const report = gradePlan(
                loadSampleWorld(),
                carPlan([...TO_R1_PICK_O1, { t: 10, cmd: "go", to: "H2" }, { t: 10, cmd: "dropoff", order: "O1" }]),
            );
            expect(report.errors[0]?.message).toBe("car-1[3]: dropoff O1 at H2, but its house is H1");
            expect(report.delivered).toBe(0);
        });
    });

    it("rejects pickup before ready_at", () => {
        const report = gradePlan(
            loadSampleWorld(),
            carPlan([
                { t: 6, cmd: "go", to: "R2" },
                { t: 6, cmd: "pickup", order: "O3" },
            ]),
        );
        expect(report.errors[0]?.message).toBe("car-1[1]: pickup O3 at t=6, but it is not ready until t=10");
    });

    it("rejects pickup beyond capacity", () => {
        const world = loadSampleWorld();
        // Five orders ready at R1, car capacity is 4
        const orders = ["A", "B", "C", "D", "E"].map((id) => ({ id, restaurant: "R1", house: "H1", ready_at: 0, deadline: 60 }));
        const report = gradePlan(
            { ...world, orders },
            carPlan([{ t: 5, cmd: "go", to: "R1" }, ...orders.map((o): Command => ({ t: 5, cmd: "pickup", order: o.id }))]),
        );
        expect(report.errors).toEqual([
            { driver: "car-1", index: 5, message: "car-1[5]: pickup E, but the driver is full (4/4)" },
        ]);
    });

    it("rejects a go to an unreachable node", () => {
        const world = loadSampleWorld();
        const report = gradePlan(
            { ...world, nodes: [...world.nodes, { id: "ISLAND", type: "house" }] },
            carPlan([{ t: 50, cmd: "go", to: "ISLAND" }]),
        );
        expect(report.errors[0]?.message).toBe("car-1[0]: go to ISLAND: no route from D0 that this driver can use");
    });

    it("breaks same-minute ties between drivers by driver order", () => {
        const world = loadSampleWorld();
        const twoCars: World = { ...world, drivers: [...world.drivers, { id: "car-2", class: "car", start: "D0" }] };
        const grab: Command[] = TO_R1_PICK_O1;
        const report = gradePlan(twoCars, { instance: "tier1-sample", routes: { "car-2": grab, "car-1": grab } });
        expect(report.errors).toEqual([
            { driver: "car-2", index: 1, message: "car-2[1]: pickup O1, but it was already picked up by car-1" },
        ]);
    });

    describe("broken files", () => {
        it("wrong instance", () => {
            expect(() => gradePlan(loadSampleWorld(), { instance: "tier1-02", routes: {} })).toThrow(InvalidPlanError);
        });

        it("unknown driver", () => {
            expect(() => gradePlan(loadSampleWorld(), { instance: "tier1-sample", routes: { "bike-9": [] } })).toThrow(
                'routes has unknown driver "bike-9"',
            );
        });

        it("unknown node", () => {
            expect(() => gradePlan(loadSampleWorld(), carPlan([{ t: 5, cmd: "go", to: "R9" }]))).toThrow(
                'car-1[0]: unknown node "R9"',
            );
        });

        it("unknown order", () => {
            expect(() => gradePlan(loadSampleWorld(), carPlan([{ t: 5, cmd: "pickup", order: "O9" }]))).toThrow(
                'car-1[0]: unknown order "O9"',
            );
        });
    });
});

describe("parsePlan", () => {
    it("rejects invalid JSON", () => {
        expect(() => parsePlan("{ nope")).toThrow(/not valid JSON/);
    });

    it("rejects the wrong shape with the path of the problem", () => {
        const text = JSON.stringify({ instance: "x", routes: { "car-1": [{ t: 1.5, cmd: "go", to: "R1" }] } });
        expect(() => parsePlan(text)).toThrow(/routes\.car-1\[0\]\.t/);
    });

    it("rejects misspelled command fields", () => {
        const text = JSON.stringify({ instance: "x", routes: { "car-1": [{ t: 1, cmd: "pickup", order_id: "O1" }] } });
        expect(() => parsePlan(text)).toThrow(InvalidPlanError);
    });

    it("rejects power-ups in Tier 1 but allows an empty list", () => {
        expect(() => parsePlan(JSON.stringify({ instance: "x", routes: {}, powerups: [{ t: 0, type: "turbo" }] }))).toThrow(
            /power-ups are not available/,
        );
        expect(parsePlan(JSON.stringify({ instance: "x", routes: {}, powerups: [] }))).toMatchObject({ instance: "x" });
    });
});

describe("parseWorld", () => {
    it("rejects congestion with more than one decimal", () => {
        const world = JSON.parse(readFileSync(path.join(FIXTURES, "tier1-sample.world.json"), "utf8"));
        world.edges[0].congestion = 1.25;
        expect(() => parseWorld(world)).toThrow(/one decimal/);
    });

    it("rejects edges to unknown nodes", () => {
        const world = JSON.parse(readFileSync(path.join(FIXTURES, "tier1-sample.world.json"), "utf8"));
        world.edges[0].b = "NOPE";
        expect(() => parseWorld(world)).toThrow(/unknown node NOPE/);
    });
});
