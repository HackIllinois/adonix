import Config from "../common/config";
import axios from "axios";

interface MetadataFormat {
    androidVersion: string;
    iosVersion: string;
}

export default class Metadata {
    private static metadata: MetadataFormat | undefined = undefined;

    static async load<T extends keyof MetadataFormat>(key: T): Promise<MetadataFormat[T]> {
        if (this.metadata) {
            return this.metadata[key];
        }

        const response = await axios.get(Config.METADATA_URL);
        const loaded = response.data as MetadataFormat;

        if (!loaded) {
            return Promise.reject("InvalidConfigFormat");
        }

        this.metadata = loaded;

        return this.metadata[key];
    }
}
