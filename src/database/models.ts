import mongoose from "mongoose";
import { getModelForClass } from "@typegoose/typegoose";

import { Database, generateConfig } from "../database.js";

import { AuthInfo } from "./auth-db.js";
import { AttendeeFollowing, AttendeeMetadata, AttendeeProfile } from "./attendee-db.js";
import { AdmissionDecision } from "./admission-db.js";
import { EventAttendance, EventMetadata, PublicEvent, StaffEvent, EventFollowers } from "./event-db.js";
import { NewsletterSubscription } from "./newsletter-db.js";
import { RegistrationApplication } from "./registration-db.js";
import { ShopItem } from "./shop-db.js";
import { UserAttendance, UserInfo } from "./user-db.js";
import { AnyParamConstructor } from "@typegoose/typegoose/lib/types.js";

// Collections for each database, where models will be stored
enum AttendeeCollection {
    METADATA = "metadata",
    PROFILE = "profile",
    FOLLOWING = "following",
}

enum AuthCollection {
    INFO = "info",
}

enum AdmissionCollection {
    DECISION = "decision",
}

enum EventCollection {
    METADATA = "metadata",
    ATTENDANCE = "attendance",
    STAFF_EVENTS = "staffevents",
    PUBLIC_EVENTS = "publicevents",
    FOLLOWERS = "followers",
}

enum NewsletterCollection {
    SUBSCRIPTIONS = "subscriptions",
}

enum RegistrationCollection {
    APPLICATIONS = "applications",
}

enum ShopCollection {
    ITEMS = "items",
    QUANTITIES = "quantities",
}

enum UserCollection {
    INFO = "users",
    ATTENDANCE = "attendance",
}

// Simple model getter
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getModel<T>(of: AnyParamConstructor<any>, database: Database, collection: string): mongoose.Model<T> {
    return getModelForClass(of, generateConfig(database, collection)) as unknown as mongoose.Model<T>; // required bc of any type
}

// Define models
export default class Models {
    // Attendee
    static AttendeeMetadata: mongoose.Model<AttendeeMetadata> = undefined!;
    static AttendeeProfile: mongoose.Model<AttendeeProfile> = undefined!;
    static AttendeeFollowing: mongoose.Model<AttendeeFollowing> = undefined!;
    // Auth
    static AuthInfo: mongoose.Model<AuthInfo> = undefined!;
    // Admission
    static AdmissionDecision: mongoose.Model<AdmissionDecision> = undefined!;
    // Event
    static StaffEvent: mongoose.Model<StaffEvent> = undefined!;
    static PublicEvent: mongoose.Model<PublicEvent> = undefined!;
    static EventMetadata: mongoose.Model<EventMetadata> = undefined!;
    static EventAttendance: mongoose.Model<EventAttendance> = undefined!;
    static EventFollowers: mongoose.Model<EventFollowers> = undefined!;
    // Newsletter
    static NewsletterSubscription: mongoose.Model<NewsletterSubscription> = undefined!;
    // Registration
    static RegistrationApplications: mongoose.Model<RegistrationApplication> = undefined!;
    //Shop
    static ShopItem: mongoose.Model<ShopItem> = undefined!;
    // User
    static UserInfo: mongoose.Model<UserInfo> = undefined!;
    static UserAttendance: mongoose.Model<UserAttendance> = undefined!;

    static initialize(): void {
        this.AttendeeMetadata = getModel(AttendeeMetadata, Database.ATTENDEE, AttendeeCollection.METADATA);
        this.AttendeeProfile = getModel(AttendeeProfile, Database.ATTENDEE, AttendeeCollection.PROFILE);
        this.AttendeeFollowing = getModel(AttendeeFollowing, Database.ATTENDEE, AttendeeCollection.FOLLOWING);

        this.AuthInfo = getModel(AuthInfo, Database.AUTH, AuthCollection.INFO);

        this.AdmissionDecision = getModel(AdmissionDecision, Database.ADMISSION, AdmissionCollection.DECISION);

        this.StaffEvent = getModel(StaffEvent, Database.EVENT, EventCollection.STAFF_EVENTS);
        this.PublicEvent = getModel(PublicEvent, Database.EVENT, EventCollection.PUBLIC_EVENTS);
        this.EventMetadata = getModel(EventMetadata, Database.EVENT, EventCollection.METADATA);
        this.EventAttendance = getModel(EventAttendance, Database.EVENT, EventCollection.ATTENDANCE);
        this.EventFollowers = getModel(EventFollowers, Database.EVENT, EventCollection.FOLLOWERS);

        this.NewsletterSubscription = getModel(NewsletterSubscription, Database.NEWSLETTER, NewsletterCollection.SUBSCRIPTIONS);

        this.RegistrationApplications = getModel(
            RegistrationApplication,
            Database.REGISTRATION,
            RegistrationCollection.APPLICATIONS,
        );

        this.ShopItem = getModel(ShopItem, Database.SHOP, ShopCollection.ITEMS);

        this.UserInfo = getModel(UserInfo, Database.USER, UserCollection.INFO);
        this.UserAttendance = getModel(UserAttendance, Database.USER, UserCollection.ATTENDANCE);
    }
}
