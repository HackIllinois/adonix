import mongoose, { Model } from "mongoose";
import { getModelForClass } from "@typegoose/typegoose";

import { AuthInfo } from "../services/auth/auth-schemas";
import { AttendeeProfile } from "../services/profile/profile-schemas";
import { AdmissionDecision } from "../services/admission/admission-schemas";
import { MentorOfficeHours } from "./mentor-db";
import { Event, EventAttendance, EventFollowers } from "../services/event/event-schemas";
import { NewsletterSubscription } from "../services/newsletter/newsletter-schemas";
import { RegistrationApplication } from "../services/registration/registration-schemas";
import { ShopItem } from "../services/shop/shop-schemas";
import { UserAttendance, UserFollowing, UserInfo } from "../services/user/user-schemas";
import { AnyParamConstructor, IModelOptions } from "@typegoose/typegoose/lib/types";
import { StaffShift } from "../services/staff/staff-schemas";
import { NotificationMappings, NotificationMessages } from "../services/notification/notification-schemas";
import { PuzzleItem } from "../services/puzzle/puzzle-schemas";

// Groups for collections
export enum Group {
    AUTH = "auth",
    EVENT = "event",
    ADMISSION = "admission",
    ATTENDEE = "attendee",
    MENTOR = "mentor",
    NEWSLETTER = "newsletter",
    NOTIFICATION = "notification",
    PUZZLE = "puzzle",
    REGISTRATION = "registration",
    SHOP = "shop",
    STAFF = "staff",
    USER = "user",
}

// Collections for each database, where models will be stored
enum AttendeeCollection {
    PROFILE = "profile",
}

enum AuthCollection {
    INFO = "info",
}

enum AdmissionCollection {
    DECISION = "decision",
}

enum EventCollection {
    ATTENDANCE = "attendance",
    EVENTS = "events",
    FOLLOWERS = "followers",
}

enum MentorCollection {
    OFFICE_HOURS = "officehours",
}

enum NewsletterCollection {
    SUBSCRIPTIONS = "subscriptions",
}

enum NotificationCollection {
    MAPPINGS = "mappings",
    MESSAGES = "messages",
}

enum PuzzleCollection {
    RUNES_AND_RIDDLES = "runesriddles",
}

enum RegistrationCollection {
    APPLICATIONS = "applications",
}

enum ShopCollection {
    ITEMS = "items",
}

enum StaffCollection {
    SHIFT = "shift",
}

enum UserCollection {
    INFO = "users",
    ATTENDANCE = "attendance",
    FOLLOWING = "following",
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
    static AttendeeProfile: Model<AttendeeProfile> = getModel(AttendeeProfile, Group.ATTENDEE, AttendeeCollection.PROFILE);

    // Auth
    static AuthInfo: Model<AuthInfo> = getModel(AuthInfo, Group.AUTH, AuthCollection.INFO);

    // Admission
    static AdmissionDecision: Model<AdmissionDecision> = getModel(
        AdmissionDecision,
        Group.ADMISSION,
        AdmissionCollection.DECISION,
    );

    // Event
    static Event: Model<Event> = getModel(Event, Group.EVENT, EventCollection.EVENTS);
    static EventAttendance: Model<EventAttendance> = getModel(EventAttendance, Group.EVENT, EventCollection.ATTENDANCE);
    static EventFollowers: Model<EventFollowers> = getModel(EventFollowers, Group.EVENT, EventCollection.FOLLOWERS);

    // Mentor
    static MentorOfficeHours: Model<MentorOfficeHours> = getModel(MentorOfficeHours, Group.MENTOR, MentorCollection.OFFICE_HOURS);

    // Newsletter
    static NewsletterSubscription: Model<NewsletterSubscription> = getModel(
        NewsletterSubscription,
        Group.NEWSLETTER,
        NewsletterCollection.SUBSCRIPTIONS,
    );

    // Notification
    static NotificationMappings: Model<NotificationMappings> = getModel(
        NotificationMappings,
        Group.NOTIFICATION,
        NotificationCollection.MAPPINGS,
    );

    static NotificationMessages: Model<NotificationMessages> = getModel(
        NotificationMessages,
        Group.NOTIFICATION,
        NotificationCollection.MESSAGES,
    );

    // Puzzle
    static PuzzleItem: Model<PuzzleItem> = getModel(PuzzleItem, Group.PUZZLE, PuzzleCollection.RUNES_AND_RIDDLES);

    // Registration
    static RegistrationApplication: Model<RegistrationApplication> = getModel(
        RegistrationApplication,
        Group.REGISTRATION,
        RegistrationCollection.APPLICATIONS,
    );

    // Shop
    static ShopItem: Model<ShopItem> = getModel(ShopItem, Group.SHOP, ShopCollection.ITEMS);

    // Staff
    static StaffShift: Model<StaffShift> = getModel(StaffShift, Group.STAFF, StaffCollection.SHIFT);

    // User
    static UserInfo: Model<UserInfo> = getModel(UserInfo, Group.USER, UserCollection.INFO);
    static UserAttendance: Model<UserAttendance> = getModel(UserAttendance, Group.USER, UserCollection.ATTENDANCE);
    static UserFollowing: Model<UserFollowing> = getModel(UserFollowing, Group.USER, UserCollection.FOLLOWING);
}
