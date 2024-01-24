/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */

import type { Config } from "jest";

const config: Config = {
    collectCoverage: true,
    coverageDirectory: "coverage",
    coverageProvider: "v8",

    moduleFileExtensions: ["js", "ts", "json"],
    moduleNameMapper: {
        "^(\\.{1,2}/.*)\\.js$": "$1", // Transforms requires of ./src/x.js -> ./src/x
    },

    preset: "ts-jest/presets/default-esm",

    resetModules: true,

    rootDir: "src",

    setupFiles: ["../jest.presetup.ts"],
    setupFilesAfterEnv: ["../jest.setup.ts"],

    testEnvironment: "node",
    testTimeout: 15 * 1000, // 15 second timeout per test

    transform: {
        "^.+\\.tsx?$": [
            "ts-jest",
            {
                tsconfig: "tsconfig.json",
                useESM: true,
            },
        ],
    },

    verbose: true,
};

/* CI specific config */
if (process.env.CI != undefined && process.env.CI != "0" && process.env.CI != "") {
    config.reporters = [["github-actions", { silent: false }], "summary"];
}

export default config;
