import { NextFunction, Request, Response } from "express";
import Config from "../config.js";
import axios, { AxiosResponse } from "axios";

interface ConfigFormat {
    androidVersion: string;
    iosVersion: string;
}

function isValidConfigFormat(c: ConfigFormat): boolean {
    if (typeof c.androidVersion !== "string" || typeof c.iosVersion !== "string") {
        return false;
    }

    return true;
}

export class ConfigReader {
    static iosVersion: string;
    static androidVersion: string;

    async initialize(): Promise<void> {
        const url: string = Config.METADATA_URL;

        const response: AxiosResponse = await axios.get(url);
        const configData: ConfigFormat = response.data as ConfigFormat;

        if (!configData || !isValidConfigFormat(configData)) {
            return Promise.reject("InvalidConfigFormat");
        }

        ConfigReader.androidVersion = configData.androidVersion;
        ConfigReader.iosVersion = configData.iosVersion;

        return Promise.resolve();
    }
}

const configReader: ConfigReader = new ConfigReader();

export function getConfigReader(): ConfigReader {
    return configReader;
}

export async function InitializeConfigReader(_1: Request, _: Response, next: NextFunction): Promise<void> {
    await configReader.initialize();
    next();
}
