// Keeps kit/check.py (the participants' local checker) in agreement with the real grader.
// Skipped when no Python is installed.
import { describe, expect, it } from "@jest/globals";
import { spawnSync } from "child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { gradePlan } from "./saloon-grader";
import { Powerup, Command, InvalidPlanError, parsePlan, parseWorld, Plan, World } from "./saloon-schemas";

const CHECK_PY = path.join(__dirname, "..", "..", "..", "..", "kit", "check.py");
const FIXTURES = path.join(__dirname, "__fixtures__");

function findPython(): string | null {
    for (const candidate of ["python3", "python"]) {
        const result = spawnSync(candidate, ["--version"], { encoding: "utf8" });
        if (result.status === 0 && /Python 3/.test(`${result.stdout}${result.stderr}`)) {
            return candidate;
        }
    }
    return null;
}

const PYTHON = findPython();
const describeWithPython = PYTHON ? describe : describe.skip;

const sampleWorld = (): World => parseWorld(JSON.parse(readFileSync(path.join(FIXTURES, "tier1-sample.world.json"), "utf8")));
const samplePlan = (): Plan => parsePlan(readFileSync(path.join(FIXTURES, "tier1-sample.plan.json"), "utf8"));
const route = (commands: Command[], barOrders?: Powerup[]): Plan => ({
    instance: "tier1-sample",
    routes: { "speedster-1": commands },
    ...(barOrders ? { powerups: barOrders } : {}),
});
const powerupsOn = (coins = 0): World => ({ ...sampleWorld(), powerups_enabled: true, coins });
const twoCrew = (): World => ({
    ...sampleWorld(),
    drivers: [
        { id: "speedster-1", class: "speedster", start: "S0" },
        { id: "hauler-1", class: "hauler", start: "S0" },
        { id: "disguiser-1", class: "disguiser", start: "S0" },
    ],
});
const toT1: Command[] = [
    { t: 5, cmd: "go", to: "T1" },
    { t: 5, cmd: "pickup", order: "O1" },
];

// [name, world, plan as raw JSON]
const CASES: [string, World, unknown][] = [
    ["sample plan", sampleWorld(), samplePlan()],
    ["empty plan", sampleWorld(), { instance: "tier1-sample", routes: {} }],
    ["waiting", sampleWorld(), route([{ t: 9, cmd: "go", to: "T1" }, ...toT1.slice(1).map((c) => ({ ...c, t: 9 }))])],
    ["late delivery", sampleWorld(), route([...toT1, { t: 30, cmd: "go", to: "F1" }, { t: 30, cmd: "dropoff", order: "O1" }])],
    ["too early", sampleWorld(), route([{ t: 4, cmd: "go", to: "T1" }])],
    ["backwards t", sampleWorld(), route([...toT1, { t: 3, cmd: "go", to: "F1" }])],
    ["after shift_end", sampleWorld(), route([{ t: 121, cmd: "go", to: "T1" }])],
    [
        "wrong table",
        sampleWorld(),
        route([
            { t: 5, cmd: "go", to: "T1" },
            { t: 5, cmd: "pickup", order: "O3" },
        ]),
    ],
    [
        "not ready",
        sampleWorld(),
        route([
            { t: 6, cmd: "go", to: "T2" },
            { t: 6, cmd: "pickup", order: "O3" },
        ]),
    ],
    [
        "not carrying",
        sampleWorld(),
        route([
            { t: 10, cmd: "go", to: "F1" },
            { t: 10, cmd: "dropoff", order: "O1" },
        ]),
    ],
    ["wrong fence", sampleWorld(), route([...toT1, { t: 10, cmd: "go", to: "F2" }, { t: 10, cmd: "dropoff", order: "O1" }])],
    [
        "mixed crew, restrictions and ties",
        twoCrew(),
        {
            instance: "tier1-sample",
            routes: {
                "speedster-1": toT1,
                "hauler-1": [
                    { t: 16, cmd: "go", to: "T2" },
                    { t: 16, cmd: "pickup", order: "O3" },
                    { t: 22, cmd: "go", to: "F3" },
                    { t: 22, cmd: "dropoff", order: "O3" },
                ],
                "disguiser-1": [
                    { t: 10, cmd: "go", to: "T1" },
                    { t: 10, cmd: "pickup", order: "O1" },
                ],
            },
        },
    ],
    ["powerups: coins only", powerupsOn(), samplePlan()],
    [
        "powerups: can't afford",
        powerupsOn(),
        { ...samplePlan(), powerups: [{ t: 11, type: "big_belly_burger", driver: "speedster-1" }] },
    ],
    [
        "powerups: same-minute payout",
        powerupsOn(),
        { ...samplePlan(), powerups: [{ t: 12, type: "cactus_cocktail", order: "O3" }] },
    ],
    [
        "powerups: cocktail saves a late order",
        powerupsOn(150),
        route(
            [...toT1, { t: 30, cmd: "go", to: "F1" }, { t: 30, cmd: "dropoff", order: "O1" }],
            [{ t: 0, type: "cactus_cocktail", order: "O1" }],
        ),
    ],
    [
        "powerups: cocktail too late",
        powerupsOn(150),
        route(
            [...toT1, { t: 30, cmd: "go", to: "F1" }, { t: 30, cmd: "dropoff", order: "O1" }],
            [{ t: 31, type: "cactus_cocktail", order: "O1" }],
        ),
    ],
    [
        "powerups: burger window",
        powerupsOn(300),
        route(
            [
                { t: 4, cmd: "go", to: "T1" },
                { t: 30, cmd: "go", to: "X1" },
                { t: 33, cmd: "go", to: "T1" },
            ],
            [{ t: 0, type: "big_belly_burger", driver: "speedster-1" }],
        ),
    ],
    [
        "powerups: extra satchel",
        {
            ...powerupsOn(400),
            orders: ["A", "B", "C", "D", "E"].map((id) => ({ id, target: "T1", fence: "F1", ready_at: 0, deadline: 60 })),
        },
        route(
            [
                { t: 5, cmd: "go", to: "T1" },
                ...["A", "B", "C", "D", "E"].map((id): Command => ({ t: 5, cmd: "pickup", order: id })),
            ],
            [{ t: 0, type: "extra_satchel", driver: "speedster-1" }],
        ),
    ],
    [
        "powerups: after shift_end",
        powerupsOn(300),
        { ...samplePlan(), powerups: [{ t: 121, type: "cactus_cocktail", order: "O1" }] },
    ],
    ["broken: power-ups off", sampleWorld(), { ...samplePlan(), powerups: [{ t: 0, type: "cactus_cocktail", order: "O1" }] }],
    ["broken: wrong instance", sampleWorld(), { instance: "tier1-02", routes: {} }],
    ["broken: unknown driver", sampleWorld(), { instance: "tier1-sample", routes: { "disguiser-9": [] } }],
    ["broken: unknown node", sampleWorld(), route([{ t: 5, cmd: "go", to: "T9" }])],
    ["broken: unknown order", sampleWorld(), route([{ t: 5, cmd: "pickup", order: "O9" }])],
    [
        "broken: unknown power-up driver",
        powerupsOn(),
        { ...samplePlan(), powerups: [{ t: 0, type: "extra_satchel", driver: "x" }] },
    ],
    [
        "broken: bad shape",
        sampleWorld(),
        { instance: "tier1-sample", routes: { "speedster-1": [{ t: 1.5, cmd: "go", to: "T1" }] } },
    ],
    ["broken: extra key", sampleWorld(), { instance: "tier1-sample", routes: {}, gang: "x" }],
];

/** What the real grader says, in check.py's output format. */
function officialResult(world: World, rawPlan: unknown): unknown {
    try {
        return gradePlan(world, parsePlan(JSON.stringify(rawPlan)));
    } catch (err) {
        if (err instanceof InvalidPlanError) {
            return { error: "InvalidPlan", reason: err.message };
        }
        throw err;
    }
}

describeWithPython("kit/check.py matches the official grader", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "saloon-check-"));

    it.each(CASES)("%s", (name, world, rawPlan) => {
        const slug = name.replace(/[^a-z0-9]+/gi, "-");
        const worldPath = path.join(dir, `${slug}.world.json`);
        const planPath = path.join(dir, `${slug}.plan.json`);
        writeFileSync(worldPath, JSON.stringify(world));
        writeFileSync(planPath, JSON.stringify(rawPlan));

        const result = spawnSync(PYTHON!, [CHECK_PY, worldPath, planPath], { encoding: "utf8" });
        expect(result.stderr).toBe("");
        const fromPython = JSON.parse(result.stdout);
        const official = officialResult(world, rawPlan) as Record<string, unknown>;

        if (name.startsWith("broken: bad shape") || name.startsWith("broken: extra key")) {
            // Shape errors are worded by each parser, so only the outcome has to match
            expect(fromPython.error).toBe("InvalidPlan");
            expect(official.error).toBe("InvalidPlan");
        } else {
            expect(fromPython).toEqual(official);
        }
    });
});
