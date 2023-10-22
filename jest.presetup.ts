import dotenv from "dotenv";
import path from "path";
import { jest } from "@jest/globals";
import { readFileSync } from "fs";

// Mock the env loading to load from .test.env instead
jest.mock("./src/env.js", () => {
    const rawEnv = readFileSync(path.join(__dirname, ".test.env"));
    const env = dotenv.parse(rawEnv);

    return {
        default: env,
        __esModule: true,
    };
});

// Mock models to be freshly loaded every init call so that there's no conflicts between tests
// This means initialize has to be called whenever models are used, but it fixes
// imports referencing the wrong copy
import * as _typeModels from "./src/database/models.js";

class MockedModels {
    static initialize() {
        const fresh = (jest.requireActual("./src/database/models.js") as typeof _typeModels).default;
        fresh.initialize();

        // Essentially, now that we've initialized the current models.js, copy them to our older copy
        for (const key of Object.keys(fresh)) {
            ((this as any)[key] as any) = (fresh as any)[key];
        }
    }
}

jest.mock("./src/database/models.js", () => {
    return {
        ...(jest.requireActual("./src/database/models.js") as object),
        default: MockedModels,
        __esModule: true,
    };
});
