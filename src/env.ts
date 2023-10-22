import dotenv from "dotenv";
import { readFileSync } from "fs";
import path from "path";

const rawEnv = readFileSync(path.join(process.cwd(), ".env"));
const env = dotenv.parse(rawEnv);

export default env;
