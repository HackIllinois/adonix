/*
 * This file defines all config used anywhere in the api. These values need to be defined on import.
 *
 * By moving all env variable usage to one place, we also make managing their usage much easier, and
 * can error if they are not defined.
 */

import { readFileSync } from "fs";
import env from "./env";

export enum Templates {
    REGISTRATION_SUBMISSION = "2026_registration_confirmation",
    CHALLENGE_COMPLETION = "2026_challenge_confirmation",
    STATUS_UPDATE = "2026_status_update",
    RSVP_ACCEPTED = "2026_rsvp_accepted",
    RSVP_DECLINED = "2026_rsvp_declined",
    SPONSOR_VERIFICATION_CODE = "sponsor_verification_code",
    GENERIC = "generic",
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
export const PROD_REGISTRABLE_DOMAIN = ".hackillinois.org";
export const PROD_ROOT_URL = `https://adonix${PROD_REGISTRABLE_DOMAIN}`;
const ROOT_URL = ((): string => {
    if (env.URL) {
        return env.URL;
    }
    return PROD ? PROD_ROOT_URL : `http://localhost:${PORT}`;
})();

const Config = {
    /* Environments */
    TEST: !!process.env.JEST_WORKER_ID, // Auto-detect Jest test environment
    PROD,
    VERSION: getVersion(),

    /* URLs */
    PORT,
    ROOT_URL,

    MOBILE_DEEPLINK_PROTOCOL: "hackillinois:",
    ALLOWED_WEB_HOSTS: [
        new RegExp(/^([a-z0-9-]+\.)?hackillinois\.org$/),
        new RegExp(/^[\w-]+\.systems-f4f\.workers\.dev$/),
        new RegExp(/^localhost$/),
    ],
    ALLOWED_MOBILE_REDIRECTS: [new RegExp(/^https?:\/\/auth\.expo\.dev(\/.*)?$/), new RegExp(/^hackillinois:\/\/auth$/)],

    CALLBACK_URLS: {
        GITHUB: `${ROOT_URL}/auth/github/callback/`,
        GOOGLE: `${ROOT_URL}/auth/google/callback/`,
    },

    /* OAuth, Keys, & Permissions */
    DB_URL:
        env.DB_URL || `mongodb+srv://${requireEnv("DB_USERNAME")}:${requireEnv("DB_PASSWORD")}@${requireEnv("DB_SERVER")}/main`,
    DB_PARAMS: "?retryWrites=true&w=majority",

    EXPO_ACCESS_TOKEN: requireEnv("EXPO_ACCESS_TOKEN"),

    SES_FROM_EMAIL: requireEnv("SES_FROM_EMAIL"),
    SES_REGION: requireEnv("SES_REGION"),

    GITHUB_OAUTH_ID: requireEnv("GITHUB_OAUTH_ID"),
    GITHUB_OAUTH_SECRET: requireEnv("GITHUB_OAUTH_SECRET"),

    GOOGLE_OAUTH_ID: requireEnv("GOOGLE_OAUTH_ID"),
    GOOGLE_OAUTH_SECRET: requireEnv("GOOGLE_OAUTH_SECRET"),

    JWT_SECRET: requireEnv("JWT_SECRET"),

    SYSTEM_ADMIN_LIST: requireEnv("SYSTEM_ADMINS").split(","),

    S3_REGION: requireEnv("S3_REGION"),
    S3_RESUME_BUCKET_NAME: requireEnv("S3_RESUME_BUCKET_NAME"),
    CHALLENGE_BUCKET_NAME: requireEnv("S3_CHALLENGE_BUCKET_NAME"),

    // Runes and Riddles
    PUZZLE_EVENT_END_TIME: 1708812000,
    TRUE_VALUE: 1,
    FALSE_VALUE: 0,
    PUZZLE_THRESHOLDS: new Map<number, number>([
        // [4, 25],
        // [6, 50],
        // [8, 75],
    ]),

    /* Timings */
    MILLISECONDS_PER_SECOND: 1000,
    DEFAULT_JWT_EXPIRY_TIME: "24h",
    SPONSOR_VERIFICATION_CODE_EXPIRY_SECONDS: 15 * 60,
    QR_EXPIRY_TIME_SECONDS: 20,
    RESUME_URL_EXPIRY_SECONDS: 60,
    METADATA_CACHE_EXPIRY_SECONDS: 60,
    RUNTIME_CONFIG_CACHE_EXPIRY_SECONDS: 60,
    REGISTRATION_CLOSE_TIME: parseInt(requireEnv("REGISTRATION_CLOSE_TIME")),
    STATISTIC_LOG_INTERNAL_MINUTES: 5,

    /* Defaults */
    DEFAULT_POINT_VALUE: 0,

    /* Rewards */
    MENTOR_OFFICE_HOURS_POINT_REWARD: 50,

    /* Limits */
    MAX_MAIL_SEND_RETRIES: 10,
    MIN_MAIL_BACKOFF_MS: 10,
    MAX_MAIL_BACKOFF_MS: 5000,
    SES_BULK_BATCH_SIZE: 50,
    LEADERBOARD_QUERY_LIMIT: 25,
    STATISTIC_LOG_FILTER_LIMIT: 25,
    MAX_RESUME_SIZE_BYTES: 2 * 1024 * 1024,
    MAX_REQUEST_SIZE_BYTES: 100 * 1024,
    MAX_STRING_LENGTH: 200,
    MAX_ESSAY_LENGTH: 2000,
    MAX_ARRAY_LENGTH: 20,

    /* Misc */
    SHOP_BYTES_GEN: 2,
    EVENT_BYTES_GEN: 16,
    MENTOR_BYTES_GEN: 16,
    QR_BYTES_GEN: 16,
    QR_BYTES_KEY: 32,
    QR_IV: "3a7f4b8c1d2e5f6a9b0c8d7e6f5a4b3c",
    SPONSOR_CODE_LENGTH: 6,

    SHOP_ID_LENGTH: 2 * 2,
    EVENT_ID_LENGTH: 2 * 16,
    MAX_SHOP_STOCK_PER_ITEM: 128,
    RESUME_BOOK_ENTRIES_PER_PAGE: 50,

    RANKING_OFFSET: 1,
};

export default Config;
