import { prop } from "@typegoose/typegoose";
import Config from "./config";
import Models from "./models";

export class RuntimeConfigModel {
    @prop({ required: true })
    logStatistics: boolean;
    @prop({ required: true })
    androidVersion: string;
    @prop({ required: true })
    iosVersion: string;
}

interface ConfigCache {
    config: RuntimeConfigModel;
    retrieved: number;
}

export default class RuntimeConfig {
    private static cache: ConfigCache | undefined = undefined;

    static async get<T extends keyof ConfigCache["config"]>(key: T): Promise<ConfigCache["config"][T]> {
        if (this.cache) {
            const expiresAt = this.cache.retrieved + Config.RUNTIME_CONFIG_CACHE_EXPIRY_SECONDS * Config.MILLISECONDS_PER_SECOND;
            if (Date.now() < expiresAt) {
                return this.cache.config[key];
            }
        }

        let config = await Models.RuntimeConfig.findOne();

        if (!config) {
            config = await Models.RuntimeConfig.create({
                logStatistics: false,
                androidVersion: "2020.0.0",
                iosVersion: "2020.0.0",
            } satisfies RuntimeConfigModel);

            if (!config) {
                throw new Error("Failed to create runtime config");
            }
        }

        this.cache = {
            config,
            retrieved: Date.now(),
        };

        return config[key];
    }

    static async set<T extends keyof ConfigCache["config"]>(key: T, value: ConfigCache["config"][T]): Promise<void> {
        const config = await Models.RuntimeConfig.findOneAndUpdate(
            undefined,
            {
                [key]: value,
            } satisfies Partial<ConfigCache["config"]>,
            {
                new: true,
            },
        );

        if (!config) {
            throw new Error("Config not setup yet");
        }

        this.cache = {
            config,
            retrieved: Date.now(),
        };
    }
}
