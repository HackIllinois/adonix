import { UserInfo } from "./user-schemas";
import { createCipheriv, createDecipheriv, createHash } from "crypto";
import Config from "../../common/config";
import { QRExpiredError, QRInvalidError } from "./user-schemas";
import StatusCode from "status-code-enum";

export type ScanQRCodeResult =
    | { success: true; userId: string }
    | {
          success: false;
          status: StatusCode.ClientErrorBadRequest;
          error: typeof QRExpiredError;
      }
    | {
          success: false;
          status: StatusCode.ClientErrorBadRequest;
          error: typeof QRInvalidError;
      };

export function isValidUserFormat(u: UserInfo): boolean {
    if (typeof u.userId !== "string" || typeof u.name !== "string" || typeof u.email !== "string") {
        return false;
    }

    return true;
}

// Random IV is not required because the exiry date will add enough randomness
const HARD_CODED_IV = Buffer.from("000102030405060708090a0b0c0d0e0f", "hex");
const derivedAESKey = createHash("sha256").update(Config.JWT_SECRET).digest("hex");

function encryptData(message: string, key: string): string {
    const cipher = createCipheriv("aes-256-cbc", Buffer.from(key, "hex"), HARD_CODED_IV);
    let encrypted = cipher.update(message, "utf-8", "base64");
    encrypted += cipher.final("base64");
    return encrypted;
}

function decryptData(encryptedMessage: string, key: string): string {
    const decipher = createDecipheriv("aes-256-cbc", Buffer.from(key, "hex"), HARD_CODED_IV);
    let decrypted = decipher.update(encryptedMessage, "base64", "utf-8");
    decrypted += decipher.final("utf-8");
    return decrypted;
}

export function encryptQR(userId: string, exp: number): string {
    const payload = `${userId}:${exp}`;
    const encrypted = encryptData(payload, derivedAESKey);
    return encrypted;
}

export function generateQRCode(userId: string): string {
    const currentTime = Math.floor(Date.now() / Config.MILLISECONDS_PER_SECOND);
    const exp: number = currentTime + Config.QR_EXPIRY_TIME_SECONDS;

    // Encrypt user ID and expiration timestamp
    const payload = `${userId}:${exp}`;
    const encryptedToken = encryptData(payload, derivedAESKey);

    // Construct the URI with the encrypted token
    const uri = `hackillinois://user?qr=${encryptedToken}`;

    return uri;
}

export function decryptQRCode(token: string): ScanQRCodeResult {
    const currentTime = Math.floor(Date.now() / Config.MILLISECONDS_PER_SECOND);

    // Decrypt and validate token
    const decrypted = decryptData(token, derivedAESKey);
    const [userId, exp] = decrypted.split(":");

    // Validate that userId and exp are present
    if (!userId || !exp) {
        return { success: false, status: StatusCode.ClientErrorBadRequest, error: QRInvalidError };
    }

    const expNumber = parseInt(exp, 10);
    // Validate expiration time
    if (expNumber < currentTime) {
        return { success: false, status: StatusCode.ClientErrorBadRequest, error: QRExpiredError };
    }

    // Return the userId if not expired
    return { success: true, userId };
}
