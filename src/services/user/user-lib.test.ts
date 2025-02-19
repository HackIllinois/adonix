import { describe, expect, it } from "@jest/globals";
import { decryptQRCode, generateQRCode } from "./user-lib";
import Config from "../../common/config";
import { QRExpiredError, QRInvalidError } from "./user-schemas";
import StatusCode from "status-code-enum";

describe("QR Code Encryption & Decryption", () => {
    it("should generate and correctly decrypt a QR code", () => {
        const userId = "user123";
        const qrCode = generateQRCode(userId);

        // Extract encrypted token from the QR code URI
        const token = new URL(qrCode).searchParams.get("qr")!;
        expect(token).toBeDefined();
        console.log(qrCode);

        const result = decryptQRCode(token);
        expect(result).toEqual({ success: true, userId });
    });

    it("should return QRExpiredError for an expired QR code", () => {
        const userId = "expiredUser";
        const expiredTime = Math.floor(Date.now() / Config.MILLISECONDS_PER_SECOND) - 10; // 10 seconds in the past
        const qrCode = generateQRCode(userId, expiredTime);

        const token = new URL(qrCode).searchParams.get("qr")!;
        const result = decryptQRCode(token);

        expect(result).toEqual({ success: false, status: StatusCode.ClientErrorBadRequest, error: QRExpiredError });
    });

    it("should return QRInvalidError for an invalid QR code", () => {
        const result = decryptQRCode("invalidTokenString");

        expect(result).toEqual({ success: false, status: StatusCode.ClientErrorBadRequest, error: QRInvalidError });
    });
});
