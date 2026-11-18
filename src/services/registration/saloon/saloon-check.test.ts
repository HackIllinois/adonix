// Keeps kit/check.py (the participants' local checker) in agreement with the real grader.
// Skipped when no Python is installed.
import { describe, expect, it } from "@jest/globals";
import { spawnSync } from "child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { gradePlan } from "./saloon-grader";
import { BarOrder, Command, InvalidPlanError, parsePlan, parseWorld, Plan, World } from "./saloon-schemas";

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
const route = (commands: Command[], barOrders?: BarOrder[]): Plan => ({
    instance: "tier1-sample",
    routes: { "pickpocket-1": commands },
    ...(barOrders ? { bar_orders: barOrders } : {}),
});
const openBar = (coins = 0): World => ({ ...sampleWorld(), bar_open: true, coins });
const twoCrew = (): World => ({
    ...sampleWorld(),
    mercenaries: [
        { id: "pickpocket-1", class: "pickpocket", hideout: "HQ" },
        { id: "heavy-lifter-1", class: "heavy_lifter", hideout: "HQ" },
        { id: "disguiser-1", class: "disguiser", hideout: "HQ" },
    ],
});
const toT1: Command[] = [
    { t: 5, cmd: "go", to: "T1" },
    { t: 5, cmd: "pickup", contract: "C1" },
];

// [name, world, plan as raw JSON]
const CASES: [string, World, unknown][] = [
    ["sample plan", sampleWorld(), samplePlan()],
    ["empty plan", sampleWorld(), { instance: "tier1-sample", routes: {} }],
    ["waiting", sampleWorld(), route([{ t: 9, cmd: "go", to: "T1" }, ...toT1.slice(1).map((c) => ({ ...c, t: 9 }))])],
    ["late delivery", sampleWorld(), route([...toT1, { t: 30, cmd: "go", to: "B1" }, { t: 30, cmd: "dropoff", contract: "C1" }])],
    ["too early", sampleWorld(), route([{ t: 4, cmd: "go", to: "T1" }])],
    ["backwards t", sampleWorld(), route([...toT1, { t: 3, cmd: "go", to: "B1" }])],
    ["after shift_end", sampleWorld(), route([{ t: 121, cmd: "go", to: "T1" }])],
    [
        "wrong table",
        sampleWorld(),
        route([
            { t: 5, cmd: "go", to: "T1" },
            { t: 5, cmd: "pickup", contract: "C3" },
        ]),
    ],
    [
        "not ready",
        sampleWorld(),
        route([
            { t: 6, cmd: "go", to: "T2" },
            { t: 6, cmd: "pickup", contract: "C3" },
        ]),
    ],
    [
        "not carrying",
        sampleWorld(),
        route([
            { t: 10, cmd: "go", to: "B1" },
            { t: 10, cmd: "dropoff", contract: "C1" },
        ]),
    ],
    [
        "wrong back room",
        sampleWorld(),
        route([...toT1, { t: 10, cmd: "go", to: "B2" }, { t: 10, cmd: "dropoff", contract: "C1" }]),
    ],
    [
        "mixed crew, restrictions and ties",
        twoCrew(),
        {
            instance: "tier1-sample",
            routes: {
                "pickpocket-1": toT1,
                "heavy-lifter-1": [
                    { t: 16, cmd: "go", to: "T2" },
                    { t: 16, cmd: "pickup", contract: "C3" },
                    { t: 22, cmd: "go", to: "B3" },
                    { t: 22, cmd: "dropoff", contract: "C3" },
                ],
                "disguiser-1": [
                    { t: 10, cmd: "go", to: "T1" },
                    { t: 10, cmd: "pickup", contract: "C1" },
                ],
            },
        },
    ],
    ["bar: coins only", openBar(), samplePlan()],
    [
        "bar: can't afford",
        openBar(),
        { ...samplePlan(), bar_orders: [{ t: 11, item: "big_belly_burger", mercenary: "pickpocket-1" }] },
    ],
    ["bar: same-minute payout", openBar(), { ...samplePlan(), bar_orders: [{ t: 12, item: "beer", contract: "C3" }] }],
    [
        "bar: beer saves a late bag",
        openBar(150),
        route(
            [...toT1, { t: 30, cmd: "go", to: "B1" }, { t: 30, cmd: "dropoff", contract: "C1" }],
            [{ t: 0, item: "beer", contract: "C1" }],
        ),
    ],
    [
        "bar: beer too late",
        openBar(150),
        route(
            [...toT1, { t: 30, cmd: "go", to: "B1" }, { t: 30, cmd: "dropoff", contract: "C1" }],
            [{ t: 31, item: "beer", contract: "C1" }],
        ),
    ],
    [
        "bar: burger window",
        openBar(300),
        route(
            [
                { t: 4, cmd: "go", to: "T1" },
                { t: 30, cmd: "go", to: "W1" },
                { t: 33, cmd: "go", to: "T1" },
            ],
            [{ t: 0, item: "big_belly_burger", mercenary: "pickpocket-1" }],
        ),
    ],
    [
        "bar: backpack",
        {
            ...openBar(400),
            contracts: ["A", "B", "C", "D", "E"].map((id) => ({ id, table: "T1", back_room: "B1", ready_at: 0, deadline: 60 })),
        },
        route(
            [
                { t: 5, cmd: "go", to: "T1" },
                ...["A", "B", "C", "D", "E"].map((id): Command => ({ t: 5, cmd: "pickup", contract: id })),
            ],
            [{ t: 0, item: "backpack", mercenary: "pickpocket-1" }],
        ),
    ],
    ["bar: after shift_end", openBar(300), { ...samplePlan(), bar_orders: [{ t: 121, item: "beer", contract: "C1" }] }],
    ["broken: bar closed", sampleWorld(), { ...samplePlan(), bar_orders: [{ t: 0, item: "beer", contract: "C1" }] }],
    ["broken: wrong instance", sampleWorld(), { instance: "tier1-02", routes: {} }],
    ["broken: unknown mercenary", sampleWorld(), { instance: "tier1-sample", routes: { "disguiser-9": [] } }],
    ["broken: unknown spot", sampleWorld(), route([{ t: 5, cmd: "go", to: "T9" }])],
    ["broken: unknown contract", sampleWorld(), route([{ t: 5, cmd: "pickup", contract: "C9" }])],
    ["broken: unknown bar mercenary", openBar(), { ...samplePlan(), bar_orders: [{ t: 0, item: "backpack", mercenary: "x" }] }],
    [
        "broken: bad shape",
        sampleWorld(),
        { instance: "tier1-sample", routes: { "pickpocket-1": [{ t: 1.5, cmd: "go", to: "T1" }] } },
    ],
    ["broken: extra key", sampleWorld(), { instance: "tier1-sample", routes: {}, team: "x" }],
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
