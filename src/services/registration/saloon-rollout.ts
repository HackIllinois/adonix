// Run with the deployment's Adonix environment. The default operation only reads world files.
// During the three-tier cutover, pause submissions and rerun with --recalculate-rankings.
import "../../common/init";
import mongoose from "mongoose";
import Models, { initializeDatabase } from "../../common/models";
import { ALL_TIERS, getReferenceScore, getWorldFile, liveTiers, overallScore, SALOON_INSTANCES } from "./challenge-lib";

async function checkWorlds(): Promise<number> {
    let count = 0;
    for (const tier of ALL_TIERS) {
        for (const { id } of SALOON_INSTANCES[tier]) {
            const { world } = await getWorldFile(id);
            const score = getReferenceScore(id);
            if (!score || !Number.isSafeInteger(score) || score <= 0 || world.orders.length === 0 || world.drivers.length === 0) {
                throw new Error(`Missing orders, crew or calibration for ${id}`);
            }
            if (tier === ALL_TIERS[2] && !world.powerups_enabled) {
                throw new Error(`Missing power-ups for ${id}`);
            }
            count++;
        }
    }
    return count;
}

export async function recalculateRankings(): Promise<number> {
    if (liveTiers().join(",") !== ALL_TIERS.join(",")) {
        throw new Error("Enable all three tiers before recalculating rankings");
    }
    let count = 0;
    const ranked = { $or: [{ overallScore: { $ne: null } }, { lastReport: { $ne: null } }] };
    for await (const row of Models.RegistrationChallenge.find(ranked).cursor()) {
        const { score, travelMinutes } = overallScore(row);
        if (score === null) {
            throw new Error(`Uncalibrated world in challenge ${row.id}`);
        }
        await Models.RegistrationChallenge.updateOne(
            { _id: row._id },
            { $set: { overallScore: score, overallTravelMinutes: travelMinutes } },
        );
        await Models.AdmissionDecision.updateOne({ userId: row.userId }, { $set: { proChallengeScore: score } });
        count++;
    }
    return count;
}

async function main(): Promise<void> {
    console.log(`Verified ${await checkWorlds()} worlds and reference scores.`);
    if (process.argv.includes("--recalculate-rankings")) {
        await initializeDatabase();
        try {
            console.log(`Recalculated ${await recalculateRankings()} rankings.`);
        } finally {
            await mongoose.disconnect();
        }
    }
}

if (require.main === module) {
    main().catch((error: Error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}
