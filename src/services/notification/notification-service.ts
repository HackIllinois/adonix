import { Message } from "firebase-admin/lib/messaging/messaging-api";
import Config from "../../config";
import admin, { ServiceAccount } from "firebase-admin";

function initializeFCM(): void {
    if (!admin.apps.length) {
        const encodedKey = Config.FCM_SERVICE_ACCOUNT;
        const serviceAccount = JSON.parse(atob(encodedKey)) as ServiceAccount;
        const projectName = serviceAccount.projectId;
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: `https://${projectName}.firebaseio.com/`,
        });
        ``;
    }
}

export function sendNotification(message: Message): Promise<string> {
    initializeFCM();

    return admin.messaging().send(message);
}
