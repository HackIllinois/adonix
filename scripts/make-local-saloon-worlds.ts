// Dev only: writes a copy of the sample floor plan for every Tier 1 instance id, plus a matching plan,
// so Saloon Rush can be tested locally without S3 or real generated floor plans.
// Usage: npx ts-node --transpile-only scripts/make-local-saloon-worlds.ts [outDir=local-worlds]
// Then set CHALLENGE_LOCAL_WORLDS_DIR=<outDir> (and optionally CHALLENGE_LOCAL_REFERENCE_SCORE=300) in .env
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import path from "path";
import { SALOON_INSTANCES } from "../src/services/registration/challenge-lib";

const FIXTURES = path.join(__dirname, "..", "src", "services", "registration", "saloon", "__fixtures__");
const outDir = process.argv[2] ?? "local-worlds";

const world = JSON.parse(readFileSync(path.join(FIXTURES, "tier1-sample.world.json"), "utf8"));
const plan = JSON.parse(readFileSync(path.join(FIXTURES, "tier1-sample.plan.json"), "utf8"));

mkdirSync(outDir, { recursive: true });
// Sample worlds all share one reference score (set CHALLENGE_LOCAL_REFERENCE_SCORE=300), so drop any real-world scores
rmSync(path.join(outDir, "reference-scores.json"), { force: true });
for (const { id } of SALOON_INSTANCES) {
    writeFileSync(path.join(outDir, `${id}.json`), JSON.stringify({ ...world, instance: id }, null, 4));
    writeFileSync(path.join(outDir, `${id}.plan.json`), JSON.stringify({ ...plan, instance: id }, null, 4));
}
console.log(`Wrote ${SALOON_INSTANCES.length} worlds and plans to ${path.resolve(outDir)}`);
