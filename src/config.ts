/*
 * This file defines all config used anywhere in the api. These values need to be defined on import.
 *
 * By moving all env variable usage to one place, we also make managing their usage much easier, and
 * can error if they are not defined.
 */

import env from "./env.js";

export enum Device {
    ADMIN = "admin",
    DEV = "dev",
    WEB = "web",
    IOS = "ios",
    ANDROID = "android",
}

function requireEnv(name: string): string {
    const value = env[name];

    if (value === undefined) {
        throw new Error(`Env variable ${name} is not defined!`);
    }

    return value;
}

const Config = {
    /* Jest */
    TEST: false, // False by default, will be mocked over

    /* URLs */
    PORT: env.PORT ? parseInt(env.PORT) : 3000,

    DEFAULT_DEVICE: Device.WEB,

    REDIRECT_URLS: new Map([
        [Device.ADMIN, "https://admin.hackillinois.org/auth/"],
        [Device.DEV, "https://adonix.hackillinois.org/auth/dev/"],
        [Device.WEB, "https://www.hackillinois.org/auth/"],
        [Device.IOS, "hackillinois://login/"],
        [Device.ANDROID, "hackillinois://login/"],
    ]) as Map<string, string>,

    CALLBACK_URLS: {
        GITHUB: "https://adonix.hackillinois.org/auth/github/callback/",
        // GITHUB: "http://localhost:3000/auth/github/callback/",
        GOOGLE: "https://adonix.hackillinois.org/auth/google/callback/",
        // GOOGLE: "http://127.0.0.1:3000/auth/google/callback/",
    },

    METADATA_URL: "https://hackillinois.github.io/adonix-metadata/config.json",

    /* OAuth, Keys, & Permissions */
    DB_URL: `mongodb+srv://${requireEnv("DB_USERNAME")}:${requireEnv("DB_PASSWORD")}@${requireEnv("DB_SERVER")}/`,

    GITHUB_OAUTH_ID: requireEnv("GITHUB_OAUTH_ID"),
    GITHUB_OAUTH_SECRET: requireEnv("GITHUB_OAUTH_SECRET"),

    GOOGLE_OAUTH_ID: requireEnv("GOOGLE_OAUTH_ID"),
    GOOGLE_OAUTH_SECRET: requireEnv("GOOGLE_OAUTH_SECRET"),

    JWT_SECRET: requireEnv("JWT_SECRET"),

    NEWSLETTER_CORS: {
        PROD_REGEX: requireEnv("PROD_REGEX"),
        DEPLOY_REGEX: requireEnv("DEPLOY_REGEX"),
    },

    SYSTEM_ADMIN_LIST: requireEnv("SYSTEM_ADMINS").split(","),

    /* Timings */
    MILLISECONDS_PER_SECOND: 1000,
    DEFAULT_JWT_EXPIRY_TIME: "24h",
    QR_EXPIRY_TIME: "20s",

    /* Defaults */
    DEFAULT_POINT_VALUE: 0,
    DEFAULT_FOOD_WAVE: 0,

    /* Limits */
    LEADERBOARD_QUERY_LIMIT: 25,

    /* Misc */
    EVENT_ID_LENGTH: 32,
    EVENT_BYTES_GEN: 16,
    SHOP_BYTES_GEN: 16,
};

export default Config;
