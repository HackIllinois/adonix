/*
 * This file defines all config used anywhere in the api. These values need to be defined on import.
 *
 * By moving all env variable usage to one place, we also make managing their usage much easier, and
 * can error if they are not defined.
 */

import { readFileSync } from "fs";
import env from "./env";

export enum Device {
    ADMIN = "admin",
    DEV = "dev",
    WEB = "web",
    IOS = "ios",
    ANDROID = "android",
    CHALLENGE = "challenge",
    PUZZLE = "puzzle",
}

export enum RegistrationTemplates {
    REGISTRATION_SUBMISSION = "2025_registration_confirmation",
    STATUS_UPDATE = "2024_status_update",
    RSVP_CONFIRMATION = "2024_rsvp_confirmation",
    RSVP_CONFIRMATION_WITH_REIMBURSE = "2024_rsvp_confirmation_reimburse",
    RSVP_DECLINED = "2024_rsvp_declined",
    RSVP_REMINDER_1_WEEK = "2024_rsvp-reminder-1week",
    RSVP_REMINDER_1_DAY = "2024_rsvp-reminder",
}

export enum Avatar {
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

function getVersion(): string {
    const content = JSON.parse(readFileSync("package.json").toString());
    return content.version;
}

const PROD = env.PROD ? true : false;
const PORT = env.PORT ? parseInt(env.PORT) : 3000;
export const PROD_ROOT_URL = "https://adonix.hackillinois.org";
const ROOT_URL = ((): string => {
    if (env.URL) {
        return env.URL;
    }
    return PROD ? PROD_ROOT_URL : `http://localhost:${PORT}`;
})();

const DEVICE_TO_REDIRECT_URL = new Map([
    [Device.ADMIN, "https://admin.hackillinois.org/auth/"],
    [Device.DEV, `${ROOT_URL}/auth/dev/`],
    [Device.WEB, "https://hackillinois.org/auth/"],
    [Device.CHALLENGE, `${ROOT_URL}/auth/dev/`],
    [Device.IOS, "hackillinois://login/"],
    [Device.ANDROID, "hackillinois://login/"],
    [Device.PUZZLE, "https://runes.hackillinois.org/#/auth/"],
]);

const Config = {
    /* Environments */
    TEST: false, // False by default, will be mocked over
    PROD,
    VERSION: getVersion(),

    /* URLs */
    PORT,
    ROOT_URL,

    DEFAULT_DEVICE: Device.WEB,

    DEVICE_TO_REDIRECT_URL,
    ALLOWED_REDIRECT_URLS: [
        ...DEVICE_TO_REDIRECT_URL.values(),
        new RegExp(/^http:\/\/localhost:\d+\/auth\/$/),
        new RegExp(/^https:\/\/[a-z0-9-]+--hackillinois\.netlify\.app\/auth\/$/),
    ],

    CALLBACK_URLS: {
        GITHUB: `${ROOT_URL}/auth/github/callback/`,
        GOOGLE: `${ROOT_URL}/auth/google/callback/`,
    },

    METADATA_URL: "https://hackillinois.github.io/adonix-metadata/config.json",

    /* OAuth, Keys, & Permissions */
    CORS_REGEX: requireEnv("CORS_REGEX"),

    DB_URL: `mongodb+srv://${requireEnv("DB_USERNAME")}:${requireEnv("DB_PASSWORD")}@${requireEnv("DB_SERVER")}/main`,
    DB_PARAMS: "?retryWrites=true&w=majority",

    FCM_SERVICE_ACCOUNT: requireEnv("FCM_SERVICE_ACCOUNT"),

    SPARKPOST_KEY: requireEnv("SPARKPOST_KEY"),
    SPARKPOST_URL: "https://api.sparkpost.com/api/v1/transmissions?num_rcpt_errors=3",

    GITHUB_OAUTH_ID: requireEnv("GITHUB_OAUTH_ID"),
    GITHUB_OAUTH_SECRET: requireEnv("GITHUB_OAUTH_SECRET"),

    GOOGLE_OAUTH_ID: requireEnv("GOOGLE_OAUTH_ID"),
    GOOGLE_OAUTH_SECRET: requireEnv("GOOGLE_OAUTH_SECRET"),

    JWT_SECRET: requireEnv("JWT_SECRET"),

    SYSTEM_ADMIN_LIST: requireEnv("SYSTEM_ADMINS").split(","),

    S3_ACCESS_KEY: requireEnv("S3_ACCESS_KEY"),
    S3_SECRET_KEY: requireEnv("S3_SECRET_KEY"),
    S3_REGION: requireEnv("S3_REGION"),
    S3_BUCKET_NAME: requireEnv("S3_BUCKET_NAME"),

    // Runes and Riddles
    PUZZLE_EVENT_END_TIME: 1708812000,
    TRUE_VALUE: 1,
    FALSE_VALUE: 0,

    /* Timings */
    MILLISECONDS_PER_SECOND: 1000,
    DEFAULT_JWT_EXPIRY_TIME: "24h",
    QR_EXPIRY_TIME_SECONDS: 20,
    RESUME_URL_EXPIRY_SECONDS: 60,
    METADATA_CACHE_EXPIRY_SECONDS: 60,
    REGISTRATION_CLOSE_TIME: parseInt(requireEnv("REGISTRATION_CLOSE_TIME")),

    /* Defaults */
    DEFAULT_POINT_VALUE: 0,
    DEFAULT_FOOD_WAVE: 0,
    DEFAULT_COIN_VALUE: 0,
    DEFAULT_AVATAR: Avatar.GOBLIN,

    /* Rewards */
    MENTOR_OFFICE_HOURS_POINT_REWARD: 50,

    /* Limits */
    LEADERBOARD_QUERY_LIMIT: 25,
    MAX_RESUME_SIZE_BYTES: 2 * 1024 * 1024,

    /* Misc */
    SHOP_BYTES_GEN: 2,
    EVENT_BYTES_GEN: 16,
    MENTOR_BYTES_GEN: 16,
    QR_BYTES_GEN: 16,

    SHOP_ID_LENGTH: 2 * 2,
    EVENT_ID_LENGTH: 2 * 16,
    MAX_SHOP_STOCK_PER_ITEM: 128,

    RANKING_OFFSET: 1,
};

export default Config;
