import { beforeEach, afterEach, expect, jest } from "@jest/globals";
import { MatcherState } from "expect";
import { MongoMemoryServer } from "mongodb-memory-server";

function getIdForState(state: MatcherState): string {
    return `${state.testPath}: ${state.currentTestName}`;
}

const servers = new Map<string, MongoMemoryServer>();

beforeEach(async () => {
    const baseUrl = require("./src/database/base-url.js");

    const id = getIdForState(expect.getState());

    if (servers.has(id)) {
        throw new Error(`Tests within the same file cannot have the same name, please rename: ${id}`);
    }

    const mongod = await MongoMemoryServer.create();

    servers.set(id, mongod);

    console.log("mock with", mongod.getUri());
    jest.spyOn(baseUrl, "getBaseURL").mockReturnValue(mongod.getUri());
});

afterEach(async () => {
    require("mongoose").disconnect();
    const id = getIdForState(expect.getState());

    if (!servers.has(id)) {
        return;
    }

    await servers.get(id)!.stop();
});
