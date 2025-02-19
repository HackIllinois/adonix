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

// Random IV is not required because the exiry date will add enough randomness
const HARD_CODED_IV = Buffer.from("000102030405060708090a0b0c0d0e0f", "hex");
const derivedAESKey = createHash("sha256").update(Config.JWT_SECRET).digest("hex");

function encryptData(message: string, key: string): string {
    const cipher = createCipheriv("aes-256-cbc", Buffer.from(key, "hex"), HARD_CODED_IV);
    let encrypted = cipher.update(message, "utf-8", "base64");
    encrypted += cipher.final("base64");
    return encrypted;
}

function decryptData(encryptedMessage: string, key: string): string | null {
    try {
        const decipher = createDecipheriv("aes-256-cbc", Buffer.from(key, "hex"), HARD_CODED_IV);
        let decrypted = decipher.update(encryptedMessage, "base64", "utf-8");
        decrypted += decipher.final("utf-8");
        return decrypted;
    } catch {
        return null;
    }
}

export function generateQRCode(userId: string, exp?: number): string {
    if (!exp) {
        const currentTime = Math.floor(Date.now() / Config.MILLISECONDS_PER_SECOND);
        exp = currentTime + Config.QR_EXPIRY_TIME_SECONDS;
    }

    // Encrypt user ID and expiration timestamp
    const payload = `${userId}:${exp}`;
    const encryptedToken = encryptData(payload, derivedAESKey);

    // Construct the URI with the encrypted token
    const uri = `hackillinois://user?qr=${encodeURIComponent(encryptedToken)}`;

    return uri;
}

export function decryptQRCode(token: string): ScanQRCodeResult {
    token = decodeURIComponent(token);

    const currentTime = Math.floor(Date.now() / Config.MILLISECONDS_PER_SECOND);

    // Decrypt and validate token
    const decrypted = decryptData(token, derivedAESKey);
    const [userId, exp] = decrypted?.split(":") ?? [];

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
