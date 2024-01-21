import cors, { CorsOptions } from "cors";
import Config from "../config.js";

// Only allow a certain set of regexes to be allowed via CORS
const allowedOrigins: RegExp[] = [new RegExp(Config.CORS.PROD_REGEX), new RegExp(Config.CORS.DEPLOY_REGEX)];

function regexPasses(target: string, patterns: RegExp[]): boolean {
    return patterns.some((pattern: RegExp) => {
        return pattern.test(target);
    });
}

// CORS options configuration
const corsOptions: CorsOptions = {
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
        if (!origin || regexPasses(origin, allowedOrigins)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
};

export default cors(corsOptions);
