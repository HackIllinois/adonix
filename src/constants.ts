abstract class Constants {
    // Status codes
    static readonly SUCCESS: number = 200;
    static readonly CREATED: number = 201;
    static readonly NO_CONTENT: number = 204;
    static readonly BAD_REQUEST: number = 400;
    static readonly FAILURE: number = 400;
    static readonly UNAUTHORIZED_REQUEST: number = 401;
    static readonly FORBIDDEN: number = 403;
    static readonly NOT_FOUND: number = 404;
    static readonly OLD_API: number = 418;
    static readonly INTERNAL_ERROR: number = 500;

    // URLs
    static readonly ADMIN_DEVICE: string = "admin";
    static readonly DEV_DEVICE: string = "dev";
    static readonly WEB_DEVICE: string = "web";
    static readonly IOS_DEVICE: string = "ios";
    static readonly ANDROID_DEVICE: string = "android";
    static readonly DEFAULT_DEVICE: string = Constants.WEB_DEVICE;

    private static readonly ADMIN_REDIRECT: string = "https://admin.hackillinois.org/auth/";
    private static readonly DEV_REDIRECT: string = "https://adonix.hackillinois.org/auth/dev/";
    private static readonly WEB_REDIRECT: string = "https://www.hackillinois.org/auth/";
    private static readonly IOS_REDIRECT: string = "hackillinois://login/";
    private static readonly ANDROID_REDIRECT: string = "hackillinois://login/";
    static readonly DEFAULT_REDIRECT: string = this.WEB_REDIRECT;

    static readonly REDIRECT_MAPPINGS: Map<string, string> = new Map<string, string>([
        [this.ADMIN_DEVICE, this.ADMIN_REDIRECT],
        [this.WEB_DEVICE, this.WEB_REDIRECT],
        [this.IOS_DEVICE, this.IOS_REDIRECT],
        [this.ANDROID_DEVICE, this.ANDROID_REDIRECT],
        [Constants.DEFAULT_DEVICE, this.DEFAULT_REDIRECT],
        [this.DEV_DEVICE, this.DEV_REDIRECT],
    ]);

    static readonly GITHUB_OAUTH_CALLBACK: string = "https://adonix.hackillinois.org/auth/github/callback/";
    static readonly GOOGLE_OAUTH_CALLBACK: string = "https://adonix.hackillinois.org/auth/google/callback/";
    // static readonly GOOGLE_OAUTH_CALLBACK: string = "http://127.0.0.1:3000/auth/google/callback/";
    // static readonly GITHUB_OAUTH_CALLBACK: string = "http://localhost:3000/auth/github/callback/";

    static readonly METADATA_URL: string = "https://hackillinois.github.io/adonix-metadata/config.json";

    static readonly SYSTEM_ADMIN_LIST: string[] = (process.env.SYSTEM_ADMINS ?? "").split(",");

    static readonly DEFAULT_JWT_OFFSET: string = "24h";

    // Constants for general usage
    static readonly ZERO: number = 0;
    static readonly EVENT_ID_LENGTH: number = 32;
    static readonly EVENT_BYTES_GEN: number = 16;
    static readonly MILLISECONDS_PER_SECOND: number = 1000;
    static readonly DEFAULT_POINT_VALUE: number = 0;
    static readonly DEFAULT_FOOD_WAVE: number = 0;
}

export default Constants;
