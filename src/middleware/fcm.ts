import { NextFunction, Request, Response } from "express";
import Config from "../config.js";
import admin, { ServiceAccount } from "firebase-admin";

export function NotificationsMiddleware(_: Request, res: Response, next: NextFunction): void {
    const encodedKey = Config.FCM_SERVICE_ACCOUNT;
    const serviceAccount: ServiceAccount = JSON.parse(atob(encodedKey)) as ServiceAccount;
    const projectName = serviceAccount.projectId;

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: `https://${projectName}.firebaseio.com/`,
        });
``    }

    res.locals.fcm = admin;
    next();
}