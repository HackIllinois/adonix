import mongoose, { Model } from "mongoose";
import { getModelForClass } from "@typegoose/typegoose";

import { AuthInfo } from "./auth-db.js";
import { AttendeeFollowing, AttendeeMetadata, AttendeeProfile } from "./attendee-db.js";
import { AdmissionDecision } from "./admission-db.js";
import { EventAttendance, EventMetadata, PublicEvent, StaffEvent, EventFollowers } from "./event-db.js";
import { MentorOfficeHours } from "./mentor-db.js";
import { NewsletterSubscription } from "./newsletter-db.js";
import { RegistrationApplication } from "./registration-db.js";
import { ShopItem } from "./shop-db.js";
import { UserAttendance, UserInfo } from "./user-db.js";
import { AnyParamConstructor, IModelOptions } from "@typegoose/typegoose/lib/types.js";

// Groups for collections
export enum Group {
    AUTH = "auth",
    USER = "user",
    EVENT = "event",
    ADMISSION = "admission",
    ATTENDEE = "attendee",
    MENTOR = "mentor",
    NEWSLETTER = "newsletter",
    REGISTRATION = "registration",
    SHOP = "shop",
}

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

enum MentorCollection {
    OFFICE_HOURS = "officehours",
}

enum NewsletterCollection {
    SUBSCRIPTIONS = "subscriptions",
}

enum RegistrationCollection {
    APPLICATIONS = "applications",
}

enum ShopCollection {
    ITEMS = "items",
}

enum UserCollection {
    INFO = "users",
    ATTENDANCE = "attendance",
}

export function generateConfig(collection: string): IModelOptions {
    return {
        schemaOptions: { collection: collection, versionKey: false },
    };
}

// Simple model getter
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getModel<T>(of: AnyParamConstructor<any>, group: Group, collection: string): mongoose.Model<T> {
    return getModelForClass(of, generateConfig(`${group}_${collection}`)) as unknown as mongoose.Model<T>; // required bc of any type
}

// Define models
export default class Models {
    // Attendee
    static AttendeeMetadata: Model<AttendeeMetadata> = getModel(AttendeeMetadata, Group.ATTENDEE, AttendeeCollection.METADATA);
    static AttendeeProfile: Model<AttendeeProfile> = getModel(AttendeeProfile, Group.ATTENDEE, AttendeeCollection.PROFILE);
    static AttendeeFollowing: Model<AttendeeFollowing> = getModel(
        AttendeeFollowing,
        Group.ATTENDEE,
        AttendeeCollection.FOLLOWING,
    );

    // Auth
    static AuthInfo: Model<AuthInfo> = getModel(AuthInfo, Group.AUTH, AuthCollection.INFO);

    // Admission
    static AdmissionDecision: Model<AdmissionDecision> = getModel(
        AdmissionDecision,
        Group.ADMISSION,
        AdmissionCollection.DECISION,
    );

    // Event
    static StaffEvent: Model<StaffEvent> = getModel(StaffEvent, Group.EVENT, EventCollection.STAFF_EVENTS);
    static PublicEvent: Model<PublicEvent> = getModel(PublicEvent, Group.EVENT, EventCollection.PUBLIC_EVENTS);
    static EventMetadata: Model<EventMetadata> = getModel(EventMetadata, Group.EVENT, EventCollection.METADATA);
    static EventAttendance: Model<EventAttendance> = getModel(EventAttendance, Group.EVENT, EventCollection.ATTENDANCE);
    static EventFollowers: Model<EventFollowers> = getModel(EventFollowers, Group.EVENT, EventCollection.FOLLOWERS);

    // Mentor
    static MentorOfficeHours: Model<MentorOfficeHours> = getModel(
        MentorOfficeHours,
        Group.MENTOR,
        MentorCollection.OFFICE_HOURS,
    );

    // Newsletter
    static NewsletterSubscription: Model<NewsletterSubscription> = getModel(
        NewsletterSubscription,
        Group.NEWSLETTER,
        NewsletterCollection.SUBSCRIPTIONS,
    );

    // Registration
    static RegistrationApplication: Model<RegistrationApplication> = getModel(
        RegistrationApplication,
        Group.REGISTRATION,
        RegistrationCollection.APPLICATIONS,
    );

    // Shop
    static ShopItem: Model<ShopItem> = getModel(ShopItem, Group.SHOP, ShopCollection.ITEMS);

    // User
    static UserInfo: Model<UserInfo> = getModel(UserInfo, Group.USER, UserCollection.INFO);
    static UserAttendance: Model<UserAttendance> = getModel(UserAttendance, Group.USER, UserCollection.ATTENDANCE);
}
