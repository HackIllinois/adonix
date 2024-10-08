import dotenv from "dotenv";
import path from "path";
import { jest } from "@jest/globals";
import { readFileSync } from "fs";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import type zodType from "zod";

// Mock the env loading to load from .test.env instead
jest.mock("./src/env.js", () => {
    const rawEnv = readFileSync(path.join(__dirname, ".test.env"));
    const env = dotenv.parse(rawEnv);

    return {
        default: env,
        __esModule: true,
    };
});

// Mock extended zod since types.ts doesn't work for some reason
jest.mock("zod", () => {
    const zod = jest.requireActual("zod");
    extendZodWithOpenApi(zod as typeof zodType);
    return zod;
});
