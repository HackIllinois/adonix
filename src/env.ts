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
