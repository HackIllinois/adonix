import mongoose from "mongoose";
import { getModelForClass } from "@typegoose/typegoose";

import { Database, generateConfig } from "../database.js";

import { AuthInfo } from "./auth-db.js";
import { AttendeeMetadata, AttendeeProfile } from "./attendee-db.js";
import { DecisionEntry, DecisionInfo } from "./decision-db.js";
import { EventAttendance, EventMetadata, PublicEvent, StaffEvent } from "./event-db.js";
import { NewsletterSubscription } from "./newsletter-db.js";
import { Application, RegistrationInfo } from "./registration-db.js";
import { UserAttendance, UserInfo } from "./user-db.js";
import { AnyParamConstructor } from "@typegoose/typegoose/lib/types.js";

// Collections for each database, where models will be stored
enum AttendeeCollection {
    METADATA = "metadata",
    PROFILE = "profile",
}

enum AuthCollection {
    INFO = "info",
}

enum DecisionCollection {
    INFO = "info",
    ENTRIES = "entries",
}

enum EventCollection {
    METADATA = "metadata",
    ATTENDANCE = "attendance",
    STAFF_EVENTS = "staffevents",
    PUBLIC_EVENTS = "publicevents",
}

enum NewsletterCollection {
    SUBSCRIPTIONS = "subscriptions",
}

enum RegistrationCollection {
    INFO = "info",
    APPLICATION = "application",
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
    // Auth
    static AuthInfo: mongoose.Model<AuthInfo> = undefined!;
    // Decision
    static DecisionInfo: mongoose.Model<DecisionInfo> = undefined!;
    static DecisionEntry: mongoose.Model<DecisionEntry> = undefined!;
    // Event
    static StaffEvent: mongoose.Model<StaffEvent> = undefined!;
    static PublicEvent: mongoose.Model<PublicEvent> = undefined!;
    static EventMetadata: mongoose.Model<EventMetadata> = undefined!;
    static EventAttendance: mongoose.Model<EventAttendance> = undefined!;
    // Newsletter
    static NewsletterSubscription: mongoose.Model<NewsletterSubscription> = undefined!;
    // Registration
    static RegistrationInfo: mongoose.Model<RegistrationInfo> = undefined!;
    static Application: mongoose.Model<Application> = undefined!;
    // User
    static UserInfo: mongoose.Model<UserInfo> = undefined!;
    static UserAttendance: mongoose.Model<UserAttendance> = undefined!;

    static initialize(): void {
        this.AttendeeMetadata = getModel(AttendeeMetadata, Database.ATTENDEE, AttendeeCollection.METADATA);
        this.AttendeeProfile = getModel(AttendeeProfile, Database.ATTENDEE, AttendeeCollection.PROFILE);
        this.AuthInfo = getModel(AuthInfo, Database.AUTH, AuthCollection.INFO);
        this.DecisionInfo = getModel(DecisionInfo, Database.DECISION, DecisionCollection.INFO);
        this.DecisionEntry = getModel(DecisionEntry, Database.DECISION, DecisionCollection.ENTRIES);
        this.StaffEvent = getModel(StaffEvent, Database.EVENT, EventCollection.STAFF_EVENTS);
        this.PublicEvent = getModel(PublicEvent, Database.EVENT, EventCollection.PUBLIC_EVENTS);
        this.EventMetadata = getModel(EventMetadata, Database.EVENT, EventCollection.METADATA);
        this.EventAttendance = getModel(EventAttendance, Database.EVENT, EventCollection.ATTENDANCE);
        this.NewsletterSubscription = getModel(NewsletterSubscription, Database.NEWSLETTER, NewsletterCollection.SUBSCRIPTIONS);
        this.RegistrationInfo = getModel(RegistrationInfo, Database.DECISION, RegistrationCollection.INFO);
        this.Application = getModel(Application, Database.DECISION, RegistrationCollection.APPLICATION);
        this.UserInfo = getModel(UserInfo, Database.USER, UserCollection.INFO);
        this.UserAttendance = getModel(UserAttendance, Database.USER, UserCollection.ATTENDANCE);
    }
}
