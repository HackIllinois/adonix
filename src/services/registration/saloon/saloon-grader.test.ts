import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "fs";
import path from "path";
import { contractPoints, gradePlan } from "./saloon-grader";
import { Command, InvalidPlanError, parsePlan, parseWorld, Plan, World } from "./saloon-schemas";

const FIXTURES = path.join(__dirname, "__fixtures__");

function loadSampleWorld(): World {
    return parseWorld(JSON.parse(readFileSync(path.join(FIXTURES, "tier1-sample.world.json"), "utf8")));
}

function loadSamplePlan(): Plan {
    return parsePlan(readFileSync(path.join(FIXTURES, "tier1-sample.plan.json"), "utf8"));
}

function pickpocketPlan(commands: Command[]): Plan {
    return { instance: "tier1-sample", routes: { "pickpocket-1": commands } };
}

// HQ -> T1 takes 5 minutes, T1 -> B1 takes 5 (direct) or 7 (via B2)
const TO_T1_LIFT_C1: Command[] = [
    { t: 5, cmd: "go", to: "T1" },
    { t: 5, cmd: "pickup", contract: "C1" },
];

describe("gradePlan", () => {
    it("scores the sample plan: all three on time", () => {
        expect(gradePlan(loadSampleWorld(), loadSamplePlan())).toEqual({
            instance: "tier1-sample",
            score: 300,
            totalContracts: 3,
            completed: 3,
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
        expect(report).toMatchObject({ score: 0, completed: 0, errors: [] });
    });

    it("treats a later t as waiting", () => {
        const report = gradePlan(
            loadSampleWorld(),
            pickpocketPlan([
                { t: 9, cmd: "go", to: "T1" },
                { t: 9, cmd: "pickup", contract: "C1" },
                { t: 15, cmd: "go", to: "B1" },
                { t: 15, cmd: "dropoff", contract: "C1" },
            ]),
        );
        expect(report).toMatchObject({ score: 100, onTime: 1, travelMinutes: 10, errors: [] });
    });

    it("subtracts 5 points per late minute with a floor of 20", () => {
        expect(contractPoints(20, 20)).toBe(100);
        expect(contractPoints(10, 20)).toBe(100);
        expect(contractPoints(21, 20)).toBe(95);
        expect(contractPoints(36, 20)).toBe(20);
        expect(contractPoints(100, 20)).toBe(20);

        const report = gradePlan(
            loadSampleWorld(),
            pickpocketPlan([...TO_T1_LIFT_C1, { t: 30, cmd: "go", to: "B1" }, { t: 30, cmd: "dropoff", contract: "C1" }]),
        );
        expect(report).toMatchObject({ score: 50, completed: 1, onTime: 0, lateMinutes: 10 });
    });

    it("scores a bag lifted but never dropped off as zero", () => {
        const report = gradePlan(loadSampleWorld(), pickpocketPlan(TO_T1_LIFT_C1));
        expect(report).toMatchObject({ score: 0, completed: 0, errors: [] });
    });

    describe("invalid commands cut the route but keep earlier contracts", () => {
        const completeC1: Command[] = [
            ...TO_T1_LIFT_C1,
            { t: 10, cmd: "go", to: "B1" },
            { t: 10, cmd: "dropoff", contract: "C1" },
        ];

        function expectCutAt(extra: Command[], message: string): void {
            const report = gradePlan(
                loadSampleWorld(),
                pickpocketPlan([...completeC1, ...extra, { t: 119, cmd: "go", to: "HQ" }]),
            );
            expect(report.score).toBe(100);
            expect(report.completed).toBe(1);
            expect(report.errors).toEqual([{ mercenary: "pickpocket-1", index: completeC1.length, message }]);
        }

        it("go arriving too early", () => {
            expectCutAt([{ t: 13, cmd: "go", to: "T1" }], "pickpocket-1[4]: go to T1 at t=13, earliest possible t=15");
        });

        it("t going backwards", () => {
            expectCutAt(
                [{ t: 9, cmd: "go", to: "B1" }],
                "pickpocket-1[4]: go at t=9 is earlier than the previous command at t=10",
            );
        });

        it("t after shift_end", () => {
            expectCutAt([{ t: 121, cmd: "go", to: "T1" }], "pickpocket-1[4]: go at t=121 is after shift_end=120");
        });

        it("pickup at the wrong spot", () => {
            expectCutAt([{ t: 10, cmd: "pickup", contract: "C2" }], "pickpocket-1[4]: pickup C2 at B1, but its game table is T1");
        });

        it("pickup twice", () => {
            const report = gradePlan(
                loadSampleWorld(),
                pickpocketPlan([...completeC1, { t: 15, cmd: "go", to: "T1" }, { t: 15, cmd: "pickup", contract: "C1" }]),
            );
            expect(report.score).toBe(100);
            expect(report.errors).toEqual([
                {
                    mercenary: "pickpocket-1",
                    index: 5,
                    message: "pickpocket-1[5]: pickup C1, but it was already lifted by pickpocket-1",
                },
            ]);
        });

        it("dropoff of a bag the mercenary isn't carrying", () => {
            expectCutAt(
                [{ t: 10, cmd: "dropoff", contract: "C2" }],
                "pickpocket-1[4]: dropoff C2, but this mercenary isn't carrying it",
            );
        });

        it("dropoff at the wrong back room", () => {
            const report = gradePlan(
                loadSampleWorld(),
                pickpocketPlan([...TO_T1_LIFT_C1, { t: 10, cmd: "go", to: "B2" }, { t: 10, cmd: "dropoff", contract: "C1" }]),
            );
            expect(report.errors[0]?.message).toBe("pickpocket-1[3]: dropoff C1 at B2, but its back room is B1");
            expect(report.completed).toBe(0);
        });
    });

    it("rejects pickup before ready_at", () => {
        const report = gradePlan(
            loadSampleWorld(),
            pickpocketPlan([
                { t: 6, cmd: "go", to: "T2" },
                { t: 6, cmd: "pickup", contract: "C3" },
            ]),
        );
        expect(report.errors[0]?.message).toBe("pickpocket-1[1]: pickup C3 at t=6, but the bag isn't ready until t=10");
    });

    it("rejects pickup beyond the satchel size", () => {
        const world = loadSampleWorld();
        // Five bags ready at T1, a pickpocket's satchel holds 4
        const contracts = ["A", "B", "C", "D", "E"].map((id) => ({
            id,
            table: "T1",
            back_room: "B1",
            ready_at: 0,
            deadline: 60,
        }));
        const report = gradePlan(
            { ...world, contracts },
            pickpocketPlan([
                { t: 5, cmd: "go", to: "T1" },
                ...contracts.map((c): Command => ({ t: 5, cmd: "pickup", contract: c.id })),
            ]),
        );
        expect(report.errors).toEqual([
            { mercenary: "pickpocket-1", index: 5, message: "pickpocket-1[5]: pickup E, but the satchel is full (4/4)" },
        ]);
    });

    it("rejects a go to an unreachable spot", () => {
        const world = loadSampleWorld();
        const report = gradePlan(
            { ...world, nodes: [...world.nodes, { id: "CELLAR", type: "back_room" }] },
            pickpocketPlan([{ t: 50, cmd: "go", to: "CELLAR" }]),
        );
        expect(report.errors[0]?.message).toBe("pickpocket-1[0]: go to CELLAR: no path from HQ this mercenary can use");
    });

    it("breaks same-minute ties between mercenaries by crew order", () => {
        const world = loadSampleWorld();
        const twoPickpockets: World = {
            ...world,
            mercenaries: [...world.mercenaries, { id: "pickpocket-2", class: "pickpocket", hideout: "HQ" }],
        };
        const grab: Command[] = TO_T1_LIFT_C1;
        const report = gradePlan(twoPickpockets, {
            instance: "tier1-sample",
            routes: { "pickpocket-2": grab, "pickpocket-1": grab },
        });
        expect(report.errors).toEqual([
            {
                mercenary: "pickpocket-2",
                index: 1,
                message: "pickpocket-2[1]: pickup C1, but it was already lifted by pickpocket-1",
            },
        ]);
    });

    describe("broken files", () => {
        it("wrong instance", () => {
            expect(() => gradePlan(loadSampleWorld(), { instance: "tier1-02", routes: {} })).toThrow(InvalidPlanError);
        });

        it("unknown mercenary", () => {
            expect(() => gradePlan(loadSampleWorld(), { instance: "tier1-sample", routes: { "disguiser-9": [] } })).toThrow(
                'routes has unknown mercenary "disguiser-9"',
            );
        });

        it("unknown spot", () => {
            expect(() => gradePlan(loadSampleWorld(), pickpocketPlan([{ t: 5, cmd: "go", to: "T9" }]))).toThrow(
                'pickpocket-1[0]: unknown spot "T9"',
            );
        });

        it("unknown contract", () => {
            expect(() => gradePlan(loadSampleWorld(), pickpocketPlan([{ t: 5, cmd: "pickup", contract: "C9" }]))).toThrow(
                'pickpocket-1[0]: unknown contract "C9"',
            );
        });
    });
});

describe("parsePlan", () => {
    it("rejects invalid JSON", () => {
        expect(() => parsePlan("{ nope")).toThrow(/not valid JSON/);
    });

    it("rejects the wrong shape with the path of the problem", () => {
        const text = JSON.stringify({ instance: "x", routes: { "pickpocket-1": [{ t: 1.5, cmd: "go", to: "T1" }] } });
        expect(() => parsePlan(text)).toThrow(/routes\.pickpocket-1\[0\]\.t/);
    });

    it("rejects misspelled command fields", () => {
        const text = JSON.stringify({ instance: "x", routes: { "pickpocket-1": [{ t: 1, cmd: "pickup", contract_id: "C1" }] } });
        expect(() => parsePlan(text)).toThrow(InvalidPlanError);
    });

    it("rejects bar orders in Tier 1 but allows an empty list", () => {
        expect(() =>
            parsePlan(JSON.stringify({ instance: "x", routes: {}, bar_orders: [{ t: 0, item: "big_belly_burger" }] })),
        ).toThrow(/bar orders aren't on the menu/);
        expect(parsePlan(JSON.stringify({ instance: "x", routes: {}, bar_orders: [] }))).toMatchObject({ instance: "x" });
    });
});

describe("parseWorld", () => {
    it("rejects a crowd with more than one decimal", () => {
        const world = JSON.parse(readFileSync(path.join(FIXTURES, "tier1-sample.world.json"), "utf8"));
        world.connections[0].crowd = 1.25;
        expect(() => parseWorld(world)).toThrow(/one decimal/);
    });

    it("rejects connections to unknown spots", () => {
        const world = JSON.parse(readFileSync(path.join(FIXTURES, "tier1-sample.world.json"), "utf8"));
        world.connections[0].b = "NOPE";
        expect(() => parseWorld(world)).toThrow(/unknown spot NOPE/);
    });
});
