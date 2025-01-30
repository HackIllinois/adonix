import { UserInfo } from "./user-schemas";
// import * as crypto from 'crypto';
// import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import * as CryptoJS from 'crypto-js'
import Config from "../../common/config";

export function isValidUserFormat(u: UserInfo): boolean {
    if (typeof u.userId !== "string" || typeof u.name !== "string" || typeof u.email !== "string") {
        return false;
    }

    return true;
}

export function encryptQR(userId: string, exp: number): string {
    const payload = `${userId}:${exp}`;
    const encrypted = CryptoJS.AES.encrypt(payload, Config.JWT_SECRET).toString();
    return encrypted;
}


export function decryptQR(token: string): { userId: string; exp: number } {
    // Decrypt the token
    const decrypted = CryptoJS.AES.decrypt(token, Config.JWT_SECRET).toString(CryptoJS.enc.Utf8);

    // Check if the decrypted data is valid
    if (!decrypted || !decrypted.includes(":")) {
        throw new Error("Invalid or corrupted token");
    }

    // Split the decrypted payload into userId and exp
    const [userId, exp] = decrypted.split(":");

    // Validate that userId and exp are present
    if (!userId || !exp) {
        throw new Error("Invalid or corrupted token");
    }

    // Convert exp to a number
    const expNumber = parseInt(exp, 10);
    if (isNaN(expNumber)) {
        throw new Error("Invalid expiration time");
    }

    return {
        userId: userId,
        exp: expNumber,
    };
}
