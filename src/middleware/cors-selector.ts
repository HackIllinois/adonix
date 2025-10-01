import cors, { CorsOptions } from "cors";
import Config from "../common/config";

const corsRegex = new RegExp(Config.CORS_REGEX);

// CORS options configuration
const corsOptions: CorsOptions = {
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
        const allowed = !origin || corsRegex.test(origin);
        callback(null, allowed);
    },
    credentials: true,
};

export default cors(corsOptions);
