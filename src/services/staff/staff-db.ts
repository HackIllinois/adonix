import mongoose from "mongoose";
import { EventsAttendedByStaff } from "./staff-models";
import { getModelForClass } from "@typegoose/typegoose";
import { generateConfig } from "src/database";
import Constants from "src/constants";

// Collections within the staff database
export enum StaffDB {
	ATTENDANCE = "attendance",
}

export const EventsAttendedByStaffModel: mongoose.Model<EventsAttendedByStaff> = getModelForClass(EventsAttendedByStaff, generateConfig(Constants.STAFF_DB, StaffDB.ATTENDANCE));
