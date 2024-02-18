// Runs INDIVIDUALLY for each test suite (each FILE, not test) before tests run

import { beforeEach, afterAll, expect, jest } from "@jest/globals";
import { MongoMemoryServer } from "mongodb-memory-server";
import * as Config from "./src/config.js";
import mongoose from "mongoose";
import { MatcherState } from "expect";

function mockConfig(dbUrl: string) {
    jest.mock("./src/config.js", () => {
        const actual = jest.requireActual("./src/config.js") as typeof Config;

        const newConfig: typeof Config.default = {
            ...actual.default,
            TEST: true,
            DB_URL: dbUrl,
            REGISTRATION_CLOSE_TIME_MS: 99999999999000,
        };

        return {
            ...actual,
            default: newConfig,
            __esModule: true,
        };
    });
}

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
    await mongoose.connect(`${uri}${Config.default.DB_PARAMS}`);

    mockConfig(uri);
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
