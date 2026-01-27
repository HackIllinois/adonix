import mongoose, { Model } from "mongoose";
import { getModelForClass } from "@typegoose/typegoose";

import { AuthCode, AuthInfo } from "../services/auth/auth-schemas";
import { AttendeeProfile } from "../services/profile/profile-schemas";
import { AdmissionDecision } from "../services/admission/admission-schemas";
import { MentorOfficeHours } from "../services/mentor/mentor-schemas";
import { Event, EventAttendance, EventFollowers } from "../services/event/event-schemas";
import { NewsletterSubscription } from "../services/newsletter/newsletter-schemas";
import {
    RegistrationApplicationDraft,
    RegistrationApplicationSubmitted,
    RegistrationChallenge,
} from "../services/registration/registration-schemas";
import { ShopHistory, ShopItem, ShopOrder } from "../services/shop/shop-schemas";
import { UserAttendance, UserFollowing, UserInfo } from "../services/user/user-schemas";
import { AnyParamConstructor, IModelOptions } from "@typegoose/typegoose/lib/types";
import { StaffShift, StaffInfo } from "../services/staff/staff-schemas";
import { NotificationMappings, NotificationMessages } from "../services/notification/notification-schemas";
import { PuzzleItem, PuzzleAnswer } from "../services/puzzle/puzzle-schemas";
import { Sponsor } from "../services/sponsor/sponsor-schemas";
import { StatisticLog } from "../services/statistic/statistic-schemas";
import { StaffTeam } from "../services/staff-team/staff-team-schemas";
import Config from "./config";
import { RuntimeConfigModel } from "./runtimeConfig";

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
    RUNTIME = "runtime",
    SHOP = "shop",
    SPONSOR = "sponsor",
    STAFF = "staff",
    STATISTIC = "statistic",
    STAFFTEAM = "staffteam",
    USER = "user",
}

// Collections for each database, where models will be stored
enum AttendeeCollection {
    PROFILE = "profile",
}

enum AuthCollection {
    INFO = "info",
    CODES = "codes",
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
    ANSWERS = "answers",
}

enum RegistrationCollection {
    DRAFTS = "drafts",
    SUBMISSIONS = "submissions",
    CHALLENGES = "challenges",
}

enum RuntimeCollection {
    CONFIG = "config",
}

enum ShopCollection {
    ITEMS = "items",
    HISTORY = "history",
    ORDERS = "orders",
}

enum SponsorCollection {
    SPONSORS = "sponsors",
}

enum StaffCollection {
    SHIFT = "shift",
    INFO = "info",
}

enum StaffTeamCollection {
    STAFFTEAMS = "staffteams",
}

enum StatisticCollection {
    LOGS = "logs",
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
    static AuthCode: Model<AuthCode> = getModel(AuthCode, Group.AUTH, AuthCollection.CODES);

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
    static PuzzleAnswer: Model<PuzzleAnswer> = getModel(PuzzleAnswer, Group.PUZZLE, PuzzleCollection.ANSWERS);

    // Registration
    static RegistrationApplicationDraft: Model<RegistrationApplicationDraft> = getModel(
        RegistrationApplicationDraft,
        Group.REGISTRATION,
        RegistrationCollection.DRAFTS,
    );
    static RegistrationApplicationSubmitted: Model<RegistrationApplicationSubmitted> = getModel(
        RegistrationApplicationSubmitted,
        Group.REGISTRATION,
        RegistrationCollection.SUBMISSIONS,
    );
    static RegistrationChallenge: Model<RegistrationChallenge> = getModel(
        RegistrationChallenge,
        Group.REGISTRATION,
        RegistrationCollection.CHALLENGES,
    );

    // Runtime
    static RuntimeConfig: Model<RuntimeConfigModel> = getModel(RuntimeConfigModel, Group.RUNTIME, RuntimeCollection.CONFIG);

    // Shop
    static ShopItem: Model<ShopItem> = getModel(ShopItem, Group.SHOP, ShopCollection.ITEMS);
    static ShopOrder: Model<ShopOrder> = getModel(ShopOrder, Group.SHOP, ShopCollection.ORDERS);
    static ShopHistory: Model<ShopHistory> = getModel(ShopHistory, Group.SHOP, ShopCollection.HISTORY);

    // Sponsor
    static Sponsor: Model<Sponsor> = getModel(Sponsor, Group.SPONSOR, SponsorCollection.SPONSORS);

    // Staff
    static StaffShift: Model<StaffShift> = getModel(StaffShift, Group.STAFF, StaffCollection.SHIFT);
    static StaffInfo: Model<StaffInfo> = getModel(StaffInfo, Group.STAFF, StaffCollection.INFO);

    // Statistic
    static StatisticLog: Model<StatisticLog> = getModel(StatisticLog, Group.STATISTIC, StatisticCollection.LOGS);

    // Team
    static StaffTeam: Model<StaffTeam> = getModel(StaffTeam, Group.STAFFTEAM, StaffTeamCollection.STAFFTEAMS);

    // User
    static UserInfo: Model<UserInfo> = getModel(UserInfo, Group.USER, UserCollection.INFO);
    static UserAttendance: Model<UserAttendance> = getModel(UserAttendance, Group.USER, UserCollection.ATTENDANCE);
    static UserFollowing: Model<UserFollowing> = getModel(UserFollowing, Group.USER, UserCollection.FOLLOWING);
}

let initialized = false;
export async function initializeDatabase(): Promise<void> {
    if (!initialized || Config.TEST) {
        initialized = true;
        const uri = `${Config.DB_URL}${Config.DB_PARAMS}`;
        await mongoose.connect(uri).catch((e) => {
            initialized = false;
            throw e;
        });
    }
}
