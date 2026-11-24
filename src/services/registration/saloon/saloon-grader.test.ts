import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "fs";
import path from "path";
import { POWERUPS_DISABLED_MESSAGE, orderCoins, orderPoints, gradePlan } from "./saloon-grader";
import { Powerup, Command, InvalidPlanError, parsePlan, parseWorld, Plan, World } from "./saloon-schemas";

const FIXTURES = path.join(__dirname, "__fixtures__");

function loadSampleWorld(): World {
    return parseWorld(JSON.parse(readFileSync(path.join(FIXTURES, "tier1-sample.world.json"), "utf8")));
}

function loadSamplePlan(): Plan {
    return parsePlan(readFileSync(path.join(FIXTURES, "tier1-sample.plan.json"), "utf8"));
}

function speedsterPlan(commands: Command[]): Plan {
    return { instance: "tier1-sample", routes: { "speedster-1": commands } };
}

// S0 -> T1 takes 5 minutes, T1 -> F1 takes 5 (direct) or 7 (via F2)
const TO_T1_STEAL_O1: Command[] = [
    { t: 5, cmd: "go", to: "T1" },
    { t: 5, cmd: "pickup", order: "O1" },
];

describe("gradePlan", () => {
    it("scores the sample plan: all three on time", () => {
        expect(gradePlan(loadSampleWorld(), loadSamplePlan())).toEqual({
            instance: "tier1-sample",
            score: 300,
            totalOrders: 3,
            completed: 3,
            onTime: 3,
            lateMinutes: 0,
            travelMinutes: 20,
            errors: [],
            coinsEarned: 0,
            coinsSpent: 0,
            powerupErrors: [],
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
            speedsterPlan([
                { t: 9, cmd: "go", to: "T1" },
                { t: 9, cmd: "pickup", order: "O1" },
                { t: 15, cmd: "go", to: "F1" },
                { t: 15, cmd: "dropoff", order: "O1" },
            ]),
        );
        expect(report).toMatchObject({ score: 100, onTime: 1, travelMinutes: 10, errors: [] });
    });

    it("subtracts 5 points per late minute with a floor of 20", () => {
        expect(orderPoints(20, 20)).toBe(100);
        expect(orderPoints(10, 20)).toBe(100);
        expect(orderPoints(21, 20)).toBe(95);
        expect(orderPoints(36, 20)).toBe(20);
        expect(orderPoints(100, 20)).toBe(20);

        const report = gradePlan(
            loadSampleWorld(),
            speedsterPlan([...TO_T1_STEAL_O1, { t: 30, cmd: "go", to: "F1" }, { t: 30, cmd: "dropoff", order: "O1" }]),
        );
        expect(report).toMatchObject({ score: 50, completed: 1, onTime: 0, lateMinutes: 10 });
    });

    it("scores jewelry stolen but never dropped off as zero", () => {
        const report = gradePlan(loadSampleWorld(), speedsterPlan(TO_T1_STEAL_O1));
        expect(report).toMatchObject({ score: 0, completed: 0, errors: [] });
    });

    describe("invalid commands cut the route but keep earlier orders", () => {
        const completeC1: Command[] = [...TO_T1_STEAL_O1, { t: 10, cmd: "go", to: "F1" }, { t: 10, cmd: "dropoff", order: "O1" }];

        function expectCutAt(extra: Command[], message: string): void {
            const report = gradePlan(
                loadSampleWorld(),
                speedsterPlan([...completeC1, ...extra, { t: 119, cmd: "go", to: "S0" }]),
            );
            expect(report.score).toBe(100);
            expect(report.completed).toBe(1);
            expect(report.errors).toEqual([{ driver: "speedster-1", index: completeC1.length, message }]);
        }

        it("go arriving too early", () => {
            expectCutAt([{ t: 13, cmd: "go", to: "T1" }], "speedster-1[4]: go to T1 at t=13, earliest possible t=15");
        });

        it("t going backwards", () => {
            expectCutAt(
                [{ t: 9, cmd: "go", to: "F1" }],
                "speedster-1[4]: go at t=9 is earlier than the previous command at t=10",
            );
        });

        it("t after shift_end", () => {
            expectCutAt([{ t: 121, cmd: "go", to: "T1" }], "speedster-1[4]: go at t=121 is after shift_end=120");
        });

        it("pickup at the wrong node", () => {
            expectCutAt([{ t: 10, cmd: "pickup", order: "O2" }], "speedster-1[4]: pickup O2 at F1, but its target is T1");
        });

        it("pickup twice", () => {
            const report = gradePlan(
                loadSampleWorld(),
                speedsterPlan([...completeC1, { t: 15, cmd: "go", to: "T1" }, { t: 15, cmd: "pickup", order: "O1" }]),
            );
            expect(report.score).toBe(100);
            expect(report.errors).toEqual([
                {
                    driver: "speedster-1",
                    index: 5,
                    message: "speedster-1[5]: pickup O1, but it was already stolen by speedster-1",
                },
            ]);
        });

        it("dropoff of jewelry the driver isn't carrying", () => {
            expectCutAt(
                [{ t: 10, cmd: "dropoff", order: "O2" }],
                "speedster-1[4]: dropoff O2, but this driver isn't carrying it",
            );
        });

        it("dropoff at the wrong fence", () => {
            const report = gradePlan(
                loadSampleWorld(),
                speedsterPlan([...TO_T1_STEAL_O1, { t: 10, cmd: "go", to: "F2" }, { t: 10, cmd: "dropoff", order: "O1" }]),
            );
            expect(report.errors[0]?.message).toBe("speedster-1[3]: dropoff O1 at F2, but its fence is F1");
            expect(report.completed).toBe(0);
        });
    });

    it("rejects pickup before ready_at", () => {
        const report = gradePlan(
            loadSampleWorld(),
            speedsterPlan([
                { t: 6, cmd: "go", to: "T2" },
                { t: 6, cmd: "pickup", order: "O3" },
            ]),
        );
        expect(report.errors[0]?.message).toBe("speedster-1[1]: pickup O3 at t=6, but the jewelry isn't ready until t=10");
    });

    it("rejects pickup beyond the satchel size", () => {
        const world = loadSampleWorld();
        // Five orders ready at T1, a speedster's satchel holds 4
        const orders = ["A", "B", "C", "D", "E"].map((id) => ({
            id,
            target: "T1",
            fence: "F1",
            ready_at: 0,
            deadline: 60,
        }));
        const report = gradePlan(
            { ...world, orders },
            speedsterPlan([{ t: 5, cmd: "go", to: "T1" }, ...orders.map((c): Command => ({ t: 5, cmd: "pickup", order: c.id }))]),
        );
        expect(report.errors).toEqual([
            { driver: "speedster-1", index: 5, message: "speedster-1[5]: pickup E, but the satchel is full (4/4)" },
        ]);
    });

    it("rejects a go to an unreachable node", () => {
        const world = loadSampleWorld();
        const report = gradePlan(
            { ...world, nodes: [...world.nodes, { id: "CELLAR", type: "fence" }] },
            speedsterPlan([{ t: 50, cmd: "go", to: "CELLAR" }]),
        );
        expect(report.errors[0]?.message).toBe("speedster-1[0]: go to CELLAR: no path from S0 this driver can use");
    });

    it("breaks same-minute ties between drivers by crew order", () => {
        const world = loadSampleWorld();
        const twoSpeedsters: World = {
            ...world,
            drivers: [...world.drivers, { id: "speedster-2", class: "speedster", start: "S0" }],
        };
        const grab: Command[] = TO_T1_STEAL_O1;
        const report = gradePlan(twoSpeedsters, {
            instance: "tier1-sample",
            routes: { "speedster-2": grab, "speedster-1": grab },
        });
        expect(report.errors).toEqual([
            {
                driver: "speedster-2",
                index: 1,
                message: "speedster-2[1]: pickup O1, but it was already stolen by speedster-1",
            },
        ]);
    });

    describe("broken files", () => {
        it("wrong instance", () => {
            expect(() => gradePlan(loadSampleWorld(), { instance: "tier1-02", routes: {} })).toThrow(InvalidPlanError);
        });

        it("unknown driver", () => {
            expect(() => gradePlan(loadSampleWorld(), { instance: "tier1-sample", routes: { "disguiser-9": [] } })).toThrow(
                'routes has unknown driver "disguiser-9"',
            );
        });

        it("unknown node", () => {
            expect(() => gradePlan(loadSampleWorld(), speedsterPlan([{ t: 5, cmd: "go", to: "T9" }]))).toThrow(
                'speedster-1[0]: unknown node "T9"',
            );
        });

        it("unknown order", () => {
            expect(() => gradePlan(loadSampleWorld(), speedsterPlan([{ t: 5, cmd: "pickup", order: "O9" }]))).toThrow(
                'speedster-1[0]: unknown order "O9"',
            );
        });
    });
});

describe("parsePlan", () => {
    it("rejects invalid JSON", () => {
        expect(() => parsePlan("{ nope")).toThrow(/not valid JSON/);
    });

    it("rejects the wrong shape with the path of the problem", () => {
        const text = JSON.stringify({ instance: "x", routes: { "speedster-1": [{ t: 1.5, cmd: "go", to: "T1" }] } });
        expect(() => parsePlan(text)).toThrow(/routes\.speedster-1\[0\]\.t/);
    });

    it("rejects misspelled command fields", () => {
        const text = JSON.stringify({ instance: "x", routes: { "speedster-1": [{ t: 1, cmd: "pickup", order_id: "O1" }] } });
        expect(() => parsePlan(text)).toThrow(InvalidPlanError);
    });

    it("accepts power-ups but rejects unknown types", () => {
        const order = { t: 0, type: "big_belly_burger", driver: "speedster-1" };
        expect(parsePlan(JSON.stringify({ instance: "x", routes: {}, powerups: [order] }))).toMatchObject({
            powerups: [order],
        });
        expect(() =>
            parsePlan(JSON.stringify({ instance: "x", routes: {}, powerups: [{ t: 0, type: "whiskey", driver: "x" }] })),
        ).toThrow(InvalidPlanError);
    });
});

describe("power-ups (Tier 3)", () => {
    // The sample plan drops off O2 at t=10 (15 early: 100 coins), O1 at t=12 (8 early: 50) and O3 at t=20 (10 early: 100)
    function powerupsOn(coins = 0): World {
        return { ...loadSampleWorld(), powerups_enabled: true, coins };
    }

    function withPowerups(plan: Plan, powerups: Powerup[]): Plan {
        return { ...plan, powerups };
    }

    // Late delivery of O1 (deadline 20) at t=30: 10 minutes late, 50 points
    const lateO1: Command[] = [...TO_T1_STEAL_O1, { t: 30, cmd: "go", to: "F1" }, { t: 30, cmd: "dropoff", order: "O1" }];

    it("rejects any power-up when power-ups are off, but allows an empty list", () => {
        const order: Powerup = { t: 0, type: "cactus_cocktail", order: "O1" };
        expect(() => gradePlan(loadSampleWorld(), withPowerups(loadSamplePlan(), [order]))).toThrow(POWERUPS_DISABLED_MESSAGE);
        expect(gradePlan(loadSampleWorld(), withPowerups(loadSamplePlan(), [])).score).toBe(300);
    });

    it("earns 100 coins for 10+ minutes early and 50 for on time, only while power-ups are on", () => {
        expect(gradePlan(powerupsOn(), loadSamplePlan())).toMatchObject({ score: 300, coinsEarned: 250, coinsSpent: 0 });
        expect(gradePlan(powerupsOn(300), loadSamplePlan()).coinsEarned).toBe(550);
        expect(orderCoins(10, 20)).toBe(100);
        expect(orderCoins(11, 20)).toBe(50);
        expect(orderCoins(20, 20)).toBe(50);
        expect(orderCoins(21, 20)).toBe(0);
    });

    it("skips a power-up the team can't afford and keeps going", () => {
        const report = gradePlan(
            powerupsOn(),
            withPowerups(loadSamplePlan(), [{ t: 11, type: "big_belly_burger", driver: "speedster-1" }]),
        );
        expect(report).toMatchObject({ score: 300, coinsSpent: 0, errors: [] });
        expect(report.powerupErrors).toEqual([
            { index: 0, message: "powerups[0]: big_belly_burger at t=11 costs 300 coins, only 100 available" },
        ]);
    });

    it("pays out same-minute dropoffs before buying a power-up", () => {
        // At t=12 the O1 dropoff comes first, bringing the balance to exactly 150 for the cocktail
        const report = gradePlan(powerupsOn(), withPowerups(loadSamplePlan(), [{ t: 12, type: "cactus_cocktail", order: "O3" }]));
        expect(report).toMatchObject({ coinsEarned: 250, coinsSpent: 150, powerupErrors: [] });
    });

    it("cactus cocktail pushes back a deadline by 15 minutes", () => {
        const report = gradePlan(
            powerupsOn(150),
            withPowerups(speedsterPlan(lateO1), [{ t: 0, type: "cactus_cocktail", order: "O1" }]),
        );
        // Deadline 20 -> 35, dropoff at 30 is on time (5 early: 50 coins)
        expect(report).toMatchObject({ score: 100, onTime: 1, lateMinutes: 0, coinsEarned: 200, coinsSpent: 150 });
    });

    it("skips a cactus_cocktail for an order that was already delivered", () => {
        const report = gradePlan(
            powerupsOn(150),
            withPowerups(speedsterPlan(lateO1), [{ t: 31, type: "cactus_cocktail", order: "O1" }]),
        );
        expect(report).toMatchObject({ score: 50, coinsSpent: 0 });
        expect(report.powerupErrors).toEqual([
            { index: 0, message: "powerups[0]: cactus_cocktail for O1 at t=31, but it was already delivered at t=30" },
        ]);
    });

    it("speeds up walks that start within 30 minutes of a big belly burger", () => {
        const burger: Powerup = { t: 0, type: "big_belly_burger", driver: "speedster-1" };
        // S0 -> T1 is 5 minutes normally, 4 at 1.5x speed (S0-X1 2 + X1-T1 2)
        const fast = gradePlan(powerupsOn(300), withPowerups(speedsterPlan([{ t: 4, cmd: "go", to: "T1" }]), [burger]));
        expect(fast).toMatchObject({ errors: [], travelMinutes: 4, coinsSpent: 300 });
        expect(gradePlan(powerupsOn(300), speedsterPlan([{ t: 4, cmd: "go", to: "T1" }])).errors[0]?.message).toBe(
            "speedster-1[0]: go to T1 at t=4, earliest possible t=5",
        );

        // A walk that starts at t=30 is past the window
        const late = gradePlan(
            powerupsOn(300),
            withPowerups(
                speedsterPlan([
                    { t: 30, cmd: "go", to: "S0" },
                    { t: 34, cmd: "go", to: "T1" },
                ]),
                [burger],
            ),
        );
        expect(late.errors[0]?.message).toBe("speedster-1[1]: go to T1 at t=34, earliest possible t=35");
    });

    it("extra satchel lets a driver carry two more pieces", () => {
        const orders = ["A", "B", "C", "D", "E"].map((id) => ({
            id,
            target: "T1",
            fence: "F1",
            ready_at: 0,
            deadline: 60,
        }));
        const plan = speedsterPlan([
            { t: 5, cmd: "go", to: "T1" },
            ...orders.map((c): Command => ({ t: 5, cmd: "pickup", order: c.id })),
        ]);
        const report = gradePlan(
            { ...powerupsOn(400), orders },
            withPowerups(plan, [{ t: 0, type: "extra_satchel", driver: "speedster-1" }]),
        );
        expect(report).toMatchObject({ errors: [], coinsSpent: 400 });
    });

    it("skips an order after shift_end", () => {
        const report = gradePlan(
            powerupsOn(300),
            withPowerups(loadSamplePlan(), [{ t: 121, type: "cactus_cocktail", order: "O1" }]),
        );
        expect(report.powerupErrors[0]?.message).toBe("powerups[0]: cactus_cocktail at t=121 is after shift_end=120");
    });

    it("rejects orders for unknown drivers or orders as a broken file", () => {
        expect(() =>
            gradePlan(powerupsOn(), withPowerups(loadSamplePlan(), [{ t: 0, type: "extra_satchel", driver: "disguiser-9" }])),
        ).toThrow('powerups[0]: unknown driver "disguiser-9"');
        expect(() =>
            gradePlan(powerupsOn(), withPowerups(loadSamplePlan(), [{ t: 0, type: "cactus_cocktail", order: "O9" }])),
        ).toThrow('powerups[0]: unknown order "O9"');
    });
});

describe("parseWorld", () => {
    it("rejects a congestion with more than one decimal", () => {
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
