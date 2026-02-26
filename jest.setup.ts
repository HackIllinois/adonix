// Runs INDIVIDUALLY for each test suite (each FILE, not test) before tests run

import { beforeEach, afterAll, expect } from "@jest/globals";
import { MongoMemoryServer } from "mongodb-memory-server";
import Config from "./src/common/config.js";
import mongoose from "mongoose";
import { MatcherState } from "expect";

function getIdForState(state: MatcherState): string {
    return `${state.testPath}: ${state.currentTestName}`;
}

const tests = new Set<string>();
let mongod: MongoMemoryServer | undefined = undefined;

// Need to retry because sometimes for some ports this fails randomly
// This fixes that
const MAX_RETRIES = 25;
async function makeMongod() {
    let retries = 0;

    while (true) {
        try {
            return await MongoMemoryServer.create();
        } catch (e) {
            if (retries == MAX_RETRIES) {
                throw new Error(`Failed to create mongod server ${retries} times: ${e}`);
            }
        }
        retries += 1;
    }
}

beforeEach(async () => {
    const state = expect.getState();
    const id = getIdForState(state);

    if (tests.has(id)) {
        throw new Error(`Tests within the same file cannot have the same name, please rename: ${id}`);
    } else {
        tests.add(id);
    }

    if (!mongod) {
        mongod = await makeMongod();
    }

    const dbName = `${tests.size}`;
    const uri = `${mongod.getUri()}${dbName}`;
    if (mongoose.connections.length > 0) {
        await mongoose.disconnect();
    }
    await mongoose.connect(`${uri}${Config.DB_PARAMS}`);
});

afterAll(async () => {
    for (const connection of mongoose.connections) {
        await connection.dropDatabase();
        await connection.destroy();
    }
    await mongoose.disconnect();
    if (mongod) {
        await mongod.stop();
    }
});
