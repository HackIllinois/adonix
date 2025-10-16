import cors, { CorsOptions } from "cors";
import Config from "../common/config";

// CORS options configuration
const corsOptions: CorsOptions = {
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
        if (!origin) {
            callback(null, true);
            return;
        }

        let hostname: string;
        try {
            hostname = new URL(origin).hostname;
        } catch {
            callback(null, false);
            return;
        }

        const allowed = Config.ALLOWED_WEB_HOSTS.some((regex) => regex.test(hostname));
        callback(null, allowed);
    },
    credentials: true,
};

export default cors(corsOptions);
