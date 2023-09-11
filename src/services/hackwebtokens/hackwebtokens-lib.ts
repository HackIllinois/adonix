import { encodedPayload, encodingDecodingPayload, hackWebTokenPayload } from "./hackwebtokens-models";

import * as crypto from 'crypto';
import { Collection } from "mongodb";

import DatabaseHelper from "../../database.js";

/**
 * Sends the encryption key data for a hackWebToken to the mongoDB database.
 * @param data the payload required to send to the database. contains a secretKey and an Initialization Vector (IV).
 */
export async function sendHackWebTokenPayloadToDB(data: hackWebTokenPayload) {
    const collection: Collection = await DatabaseHelper.getCollection("auth", "hackwebtokens");

    try {
        await collection.insertOne(data);
    } catch (error) {
        return Promise.reject("InternalError")
    }

    return Promise.resolve()
}

/**
 * Generates an encoded HackWebToken using AES encryption & stores the decryption key in the mongoDB database.
 * @param data the data sent to /encode. the interface contains a string user, and unknown data in the "data" field.
 * @returns a Promise with the encoded payload.
 */

export async function encodeHackWebToken(data: encodingDecodingPayload): Promise<encodedPayload> {
    const stringJson: string = JSON.stringify(data);

    const secretKey = crypto.randomBytes(32); // Generate a random 32-byte (256-bit) key
    const iv = crypto.randomBytes(16); // Generate a random 16-byte IV

    // Create a cipher using AES-256-CBC algorithm
    const cipher = crypto.createCipheriv('aes-256-cbc', secretKey, iv);

    // Update the cipher with the plain text and finalize it
    let encryptedData = cipher.update(stringJson, 'utf-8', 'hex');
    encryptedData += cipher.final('hex');

    const d: hackWebTokenPayload = {
        secretKey: secretKey.toString('hex'),
        iv: iv.toString('hex')
    }

    await sendHackWebTokenPayloadToDB(d);

    const payload: encodedPayload = {
        token: encryptedData,
        context: {
            additional_info: iv.toString('hex')
        }
    }  

    return payload;
}

/**
 * Gets the encryption key for a given HackWebToken context.
 * @param iv the Initialization Vector, a string used as part of an encryption key.
 * @returns a hackWebTokenPayload to be used for decryption.
 */
export async function getHackWebTokenFromDB(iv: string): Promise<hackWebTokenPayload> {
    const collection: Collection = await DatabaseHelper.getCollection("auth", "hackwebtokens");

	try {
		const info: hackWebTokenPayload | null = await collection.findOne({ iv: iv }) as hackWebTokenPayload | null;

		// Null check to ensure that we're not returning anything null
		if (!info) {
			return Promise.reject("UserNotFound");
		}

		return info;
	} catch {
		return Promise.reject("InternalError");
	}
}

/**
 * Decodes a HackWebToken to a decoded payload given the encoded payload
 * @param encryptedData the encoded payload. contains the token and additional info (the initialization vector)
 * @returns a decoded payload
 */
export async function decodeHackWebToken(encryptedData: encodedPayload): Promise<encodingDecodingPayload> {
    const keys: hackWebTokenPayload = await getHackWebTokenFromDB(encryptedData.context.additional_info);

    // Create a decipher using AES-256-CBC algorithm
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(keys.secretKey), Buffer.from(keys.iv, 'hex'));

    // Update the decipher with the encrypted data and finalize it
    let decryptedText = decipher.update(encryptedData.token, 'hex', 'utf-8');
    decryptedText += decipher.final('utf-8');

    let parsedStr: encodingDecodingPayload = JSON.parse(decryptedText) as encodingDecodingPayload;

    return parsedStr;
}
