// Grades a Dispatch Rush plan locally with the same code the API uses.
// Usage: npx ts-node --transpile-only scripts/grade-dispatch.ts <world.json> <plan.json> [--reference]
//   --reference   print only the score, for filling in DISPATCH_INSTANCES.referenceScore
import { readFileSync } from "fs";
import { gradePlan } from "../src/services/registration/dispatch/dispatch-grader";
import { InvalidPlanError, parsePlan, parseWorld } from "../src/services/registration/dispatch/dispatch-schemas";

function main(): number {
    const args = process.argv.slice(2);
    const referenceOnly = args.includes("--reference");
    const [worldPath, planPath] = args.filter((arg) => !arg.startsWith("--"));
    if (!worldPath || !planPath) {
        console.error("Usage: grade-dispatch.ts <world.json> <plan.json> [--reference]");
        return 2;
    }

    const world = parseWorld(JSON.parse(readFileSync(worldPath, "utf8")));
    try {
        const report = gradePlan(world, parsePlan(readFileSync(planPath, "utf8")));
        if (referenceOnly) {
            console.log(report.score);
        } else {
            console.log(JSON.stringify(report, null, 2));
        }
        return report.errors.length > 0 ? 1 : 0;
    } catch (err) {
        if (err instanceof InvalidPlanError) {
            console.error(`Invalid plan: ${err.message}`);
            return 1;
        }
        throw err;
    }
}

process.exit(main());
