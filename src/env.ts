import dotenv from "dotenv";
import { readFileSync } from "fs";
import path from "path";

const rawEnv = readFileSync(path.join(process.cwd(), ".env"));
const env = dotenv.parse(rawEnv);

for (const key in process.env) {
    const value = process.env[key];

    if (value === undefined) {
        continue;
    }

    env[key] = value;
}

export default env;
