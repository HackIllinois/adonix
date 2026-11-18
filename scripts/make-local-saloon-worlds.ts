// Dev only: writes a copy of the sample floor plan for every instance id in every tier, plus a matching plan,
// so Saloon Rush can be tested locally without S3 or real generated floor plans.
// Usage: npx ts-node --transpile-only scripts/make-local-saloon-worlds.ts [outDir=local-worlds]
// Then set CHALLENGE_LOCAL_WORLDS_DIR=<outDir> (and optionally CHALLENGE_LOCAL_REFERENCE_SCORE=300) in .env.
// Tiers 2 and 3 are only playable when PRO_CHALLENGE_TIERS lists them (e.g. PRO_CHALLENGE_TIERS=1,2,3).
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import path from "path";
import { ALL_TIERS, SALOON_INSTANCES } from "../src/services/registration/challenge-lib";

const FIXTURES = path.join(__dirname, "..", "src", "services", "registration", "saloon", "__fixtures__");
const outDir = process.argv[2] ?? "local-worlds";

const world = JSON.parse(readFileSync(path.join(FIXTURES, "tier1-sample.world.json"), "utf8"));
const plan = JSON.parse(readFileSync(path.join(FIXTURES, "tier1-sample.plan.json"), "utf8"));

mkdirSync(outDir, { recursive: true });
// Sample worlds all share one reference score (set CHALLENGE_LOCAL_REFERENCE_SCORE=300), so drop any real-world scores
rmSync(path.join(outDir, "reference-scores.json"), { force: true });
let count = 0;
for (const tier of ALL_TIERS) {
    for (const { id } of SALOON_INSTANCES[tier]) {
        // Tier 3 opens the bar menu
        const tierWorld = { ...world, instance: id, ...(tier === 3 ? { bar_open: true } : {}) };
        writeFileSync(path.join(outDir, `${id}.json`), JSON.stringify(tierWorld, null, 4));
        writeFileSync(path.join(outDir, `${id}.plan.json`), JSON.stringify({ ...plan, instance: id }, null, 4));
        count += 1;
    }
}
console.log(`Wrote ${count} worlds and plans to ${path.resolve(outDir)}`);
