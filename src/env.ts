/*
 * This file loads the env variables we will use at runtime. Instead of relying on system envs dynamically,
 * we instead parse the .env file, and overwrite any existing variables with system variables.
 * Basically, .env file vars can be overwritten by system level env vars.
 *
 * The .env is also optional so that env vars can be entirely defined with system vars if needed, like for vercel.
 */

import dotenv from "dotenv";
import { existsSync, readFileSync } from "fs";
import path from "path";

const envFilePath = path.join(process.cwd(), ".env");
const rawEnv = existsSync(envFilePath) ? readFileSync(envFilePath) : "";
const env = dotenv.parse(rawEnv);

for (const key in process.env) {
    const value = process.env[key];

    if (value === undefined) {
        continue;
    }

    env[key] = value;
}

export default env;
