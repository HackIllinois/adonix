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
