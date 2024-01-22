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
    CHALLENGE = "challenge",
}

export enum RegistrationTemplates {
    REGISTRATION_SUBMISSION = "2024_registration_confirmation",
    STATUS_UPDATE = "2024_status_update",
    RSVP_CONFIRMATION = "2024_rsvp_confirmation",
    RSVP_REMINDER_1_WEEK = "2024_rsvp-reminder-1week",
    RSVP_REMINDER_1_DAY = "2024_rsvp-reminder",
}

export enum Avatars {
    BUNNY = "bunny",
    SQUIRREL = "squirrel",
    GOBLIN = "goblin",
    CHESTER = "chester",
    CAT = "cat",
    MUSHROOM = "mushroom",
    FISHERCAT = "fishercat",
    AXOLOTL = "axolotl",
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
        [Device.CHALLENGE, "https://adonix.hackillinois.org/auth/dev/"],
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
    DB_URL: `mongodb+srv://${requireEnv("DB_USERNAME")}:${requireEnv("DB_PASSWORD")}@${requireEnv("DB_SERVER")}/main`,
    DB_PARAMS: "?retryWrites=true&w=majority",

    SPARKPOST_KEY: requireEnv("SPARKPOST_KEY"),
    SPARKPOST_URL: "https://api.sparkpost.com/api/v1/transmissions?num_rcpt_errors=3",

    GITHUB_OAUTH_ID: requireEnv("GITHUB_OAUTH_ID"),
    GITHUB_OAUTH_SECRET: requireEnv("GITHUB_OAUTH_SECRET"),

    GOOGLE_OAUTH_ID: requireEnv("GOOGLE_OAUTH_ID"),
    GOOGLE_OAUTH_SECRET: requireEnv("GOOGLE_OAUTH_SECRET"),

    JWT_SECRET: requireEnv("JWT_SECRET"),

    CORS: {
        PROD_REGEX: requireEnv("PROD_REGEX"),
        DEPLOY_REGEX: requireEnv("DEPLOY_REGEX"),
    },

    SYSTEM_ADMIN_LIST: requireEnv("SYSTEM_ADMINS").split(","),

    S3_ACCESS_KEY: requireEnv("S3_ACCESS_KEY"),
    S3_SECRET_KEY: requireEnv("S3_SECRET_KEY"),
    S3_REGION: requireEnv("S3_REGION"),
    S3_BUCKET_NAME: requireEnv("S3_BUCKET_NAME"),

    /* Timings */
    MILLISECONDS_PER_SECOND: 1000,
    DEFAULT_JWT_EXPIRY_TIME: "24h",
    QR_EXPIRY_TIME: "20s",
    RESUME_URL_EXPIRY_SECONDS: 60,

    /* Defaults */
    DEFAULT_POINT_VALUE: 0,
    DEFAULT_FOOD_WAVE: 0,
    DEFAULT_COIN_VALUE: 0,
    DEFAULT_AVATAR: "goblin",

    /* Limits */
    LEADERBOARD_QUERY_LIMIT: 25,

    /* Misc */
    SHOP_BYTES_GEN: 2,
    EVENT_BYTES_GEN: 16,

    SHOP_ID_LENGTH: 2 * 2,
    EVENT_ID_LENGTH: 2 * 16,
    MAX_SHOP_STOCK_PER_ITEM: 128,
};

export default Config;
