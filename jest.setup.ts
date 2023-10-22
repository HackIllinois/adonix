import { beforeEach, afterEach, expect, jest } from "@jest/globals";
import { MatcherState } from "expect";
import { MongoMemoryServer } from "mongodb-memory-server";
import * as Config from "./src/config.js";

function mockConfig(dbUrl: string) {
    jest.mock("./src/config.js", () => {
        const actual = jest.requireActual("./src/config.js") as typeof Config;

        const newConfig: typeof Config.default = {
            ...actual.default,
            TEST: true,
            DB_URL: dbUrl,
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

const servers = new Map<string, MongoMemoryServer>();

beforeEach(async () => {
    const id = getIdForState(expect.getState());

    if (servers.has(id)) {
        throw new Error(`Tests within the same file cannot have the same name, please rename: ${id}`);
    }

    const mongod = await MongoMemoryServer.create();

    servers.set(id, mongod);

    mockConfig(mongod.getUri());
});

afterEach(async () => {
    require("mongoose").disconnect();
    const id = getIdForState(expect.getState());

    if (!servers.has(id)) {
        return;
    }

    await servers.get(id)!.stop();
});
