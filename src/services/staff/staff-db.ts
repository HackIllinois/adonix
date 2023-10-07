import mongoose from "mongoose";
import { EventsAttendedByStaff } from "./staff-models.js";
import { getModelForClass } from "@typegoose/typegoose";
import { generateConfig } from "../../database.js";
import Constants from "../../constants.js";

// Collections within the staff database
export enum StaffDB {
    ATTENDANCE = "attendance",
}

export const EventsAttendedByStaffModel: mongoose.Model<EventsAttendedByStaff> =
    getModelForClass(
        EventsAttendedByStaff,
        generateConfig(Constants.STAFF_DB, StaffDB.ATTENDANCE),
    );
