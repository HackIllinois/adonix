import Config from "../common/config";
import axios from "axios";

interface MetadataFormat {
    androidVersion: string;
    iosVersion: string;
    retrieved: number;
}

export default class Metadata {
    private static metadata: MetadataFormat | undefined = undefined;

    static async load<T extends keyof MetadataFormat>(key: T): Promise<MetadataFormat[T]> {
        if (this.metadata) {
            const expiresAt = this.metadata.retrieved + Config.METADATA_CACHE_EXPIRY_SECONDS * Config.MILLISECONDS_PER_SECOND;
            if (Date.now() < expiresAt) {
                return this.metadata[key];
            }
        }

        const response = await axios.get<MetadataFormat>(Config.METADATA_URL);
        const loaded = response.data;

        if (!loaded) {
            return Promise.reject("InvalidConfigFormat");
        }

        this.metadata = {
            ...loaded,
            retrieved: Date.now(),
        };

        return this.metadata[key];
    }
}
