import Config from "./config.js";
import axios, { AxiosResponse } from "axios";

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

        const response: AxiosResponse = await axios.get(Config.METADATA_URL);
        const loaded: MetadataFormat = response.data as MetadataFormat;

        if (!loaded) {
            return Promise.reject("InvalidConfigFormat");
        }

        this.metadata = loaded;

        console.log(this.metadata);

        return this.metadata[key];
    }
}
