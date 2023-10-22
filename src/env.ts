import dotenv from "dotenv";
import { readFileSync } from "fs";
import path from "path";

const rawEnv = readFileSync(path.join(process.cwd(), ".env"));
const env = dotenv.parse(rawEnv);

console.log("default env runs");

export default env;
