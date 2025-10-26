import { Expo, ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";
import Config from "../../common/config";

let expo: Expo | null = null;

function getExpoClient(): Expo {
    if (!expo) {
        expo = new Expo({
            accessToken: Config.EXPO_ACCESS_TOKEN,
            useFcmV1: true,
        });
    }
    return expo;
}

export interface NotificationMessage {
    token: string;
    title: string;
    body: string;
}

export async function sendNotification(message: NotificationMessage): Promise<ExpoPushTicket> {
    const client = getExpoClient();

    // validate push token
    if (!Expo.isExpoPushToken(message.token)) {
        throw new Error(`Push token ${message.token} is not a valid Expo push token`);
    }

    // construct the Expo push message
    const expoPushMessage: ExpoPushMessage = {
        to: message.token,
        sound: "default",
        title: message.title,
        body: message.body,
    };

    // send the notification and return the ticket
    const tickets = await client.sendPushNotificationsAsync([expoPushMessage]);

    if (!tickets[0]) {
        throw new Error("Failed to receive ticket from Expo push service");
    }

    return tickets[0];
}
