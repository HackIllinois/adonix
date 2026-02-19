import { Router } from "express";
import { z } from "zod";
import { Role } from "../auth/auth-schemas";
import { getAuthenticatedUser } from "../../common/auth";
import {
    CodeExpiredError,
    CodeExpiredErrorSchema,
    ScanAttendeeRequestSchema,
    ScanAttendeeSchema,
    ShiftsAddRequestSchema,
    ShiftsSchema,
    StaffAttendanceRequestSchema,
    StaffInfoRequestSchema,
    StaffInfoSchema,
    StaffNotFoundError,
    StaffNotFoundErrorSchema,
    StaffEmailNotFoundError,
    StaffEmailNotFoundErrorSchema,
} from "./staff-schemas";
import Config from "../../common/config";
import Models from "../../common/models";
import { StatusCode } from "status-code-enum";
import { Event } from "../event/event-schemas";
import { performCheckIn, PerformCheckInErrors } from "./staff-lib";
import specification, { Tag } from "../../middleware/specification";
import { SuccessResponseSchema } from "../../common/schemas";
import { EventNotFoundError, EventNotFoundErrorSchema } from "../event/event-schemas";
import { decryptQRCode } from "../user/user-lib";
import {
    AlreadyCheckedInError,
    AlreadyCheckedInErrorSchema,
    QRExpiredError,
    QRExpiredErrorSchema,
    QRInvalidError,
    QRInvalidErrorSchema,
} from "../user/user-schemas";

const staffRouter = Router();

staffRouter.get(
    "/info/",
    specification({
        method: "get",
        path: "/staff/info/",
        tag: Tag.STAFF,
        role: Role.USER,
        summary: "Gets all active staff information for the team page",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Active staff information",
                schema: z.object({
                    staffInfo: z.array(StaffInfoSchema),
                }),
            },
        },
    }),
    async (_req, res) => {
        const staffInfo = await Models.StaffInfo.find({ isActive: true }).populate("team").lean();

        const formattedStaffInfo = staffInfo.map((info) => {
            let team;
            if (info.team) {
                team = typeof info.team === "string" ? info.team : info.team._id.toString();
            }
            return {
                ...info,
                team,
            };
        });

        return res.status(StatusCode.SuccessOK).json({ staffInfo: formattedStaffInfo });
    },
);

staffRouter.post(
    "/info/",
    specification({
        method: "post",
        path: "/staff/info/",
        tag: Tag.STAFF,
        role: Role.ADMIN,
        summary: "Creates a new staff member profile",
        body: StaffInfoRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Staff member created successfully",
                schema: SuccessResponseSchema,
            },
            [StatusCode.ClientErrorBadRequest]: {
                description: "No account found for the provided email",
                schema: StaffEmailNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const userInfo = await Models.UserInfo.findOne({ email: req.body.staffEmail });
        if (!userInfo) {
            return res.status(StatusCode.ClientErrorBadRequest).json(StaffEmailNotFoundError);
        }

        await Models.StaffInfo.create({ ...req.body, userId: userInfo.userId });
        return res.status(StatusCode.SuccessOK).json({ success: true });
    },
);

staffRouter.put(
    "/info/",
    specification({
        method: "put",
        path: "/staff/info/",
        tag: Tag.STAFF,
        role: Role.ADMIN,
        summary: "Updates an existing staff member profile",
        body: StaffInfoSchema.partial().extend({
            staffId: z.string(),
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Staff member updated successfully",
                schema: SuccessResponseSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Staff member not found",
                schema: StaffNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { staffId, ...updateData } = req.body;

        const staff = await Models.StaffInfo.findByIdAndUpdate(staffId, updateData, { new: true });

        if (!staff) {
            return res.status(StatusCode.ClientErrorNotFound).json(StaffNotFoundError);
        }

        return res.status(StatusCode.SuccessOK).json({ success: true });
    },
);

staffRouter.delete(
    "/info/",
    specification({
        method: "delete",
        path: "/staff/info/",
        tag: Tag.STAFF,
        role: Role.ADMIN,
        summary: "Deletes a staff member profile",
        body: z.object({
            staffId: z.string(),
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Staff member deleted successfully",
                schema: SuccessResponseSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Staff member not found",
                schema: StaffNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { staffId } = req.body;

        const staff = await Models.StaffInfo.findByIdAndDelete(staffId);

        if (!staff) {
            return res.status(StatusCode.ClientErrorNotFound).json(StaffNotFoundError);
        }

        return res.status(StatusCode.SuccessOK).json({ success: true });
    },
);

staffRouter.post(
    "/attendance/",
    specification({
        method: "post",
        path: "/staff/attendance/",
        tag: Tag.STAFF,
        role: Role.STAFF,
        summary: "Checks the currently authenticated staff into the specified staff event",
        body: StaffAttendanceRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The scanned user's information",
                schema: SuccessResponseSchema,
            },
            [StatusCode.ClientErrorBadRequest]: {
                description: "The event is no longer open for check in",
                schema: CodeExpiredErrorSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "The specified event was not found",
                schema: EventNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);
        const { eventId } = req.body;

        const event = await Models.Event.findOne({ eventId: eventId });

        if (!event) {
            return res.status(StatusCode.ClientErrorNotFound).json(EventNotFoundError);
        }

        const timestamp = Math.round(Date.now() / Config.MILLISECONDS_PER_SECOND);
        if (event.exp && event.exp <= timestamp) {
            return res.status(StatusCode.ClientErrorBadRequest).json(CodeExpiredError);
        }

        await Models.UserAttendance.findOneAndUpdate(
            { userId: userId },
            { $addToSet: { attendance: eventId } },
            { upsert: true },
        );
        await Models.EventAttendance.findOneAndUpdate(
            { eventId: eventId },
            { $addToSet: { attendees: userId } },
            { upsert: true },
        );
        return res.status(StatusCode.SuccessOK).send({ success: true });
    },
);

staffRouter.put(
    "/scan-attendee/",
    specification({
        method: "put",
        path: "/staff/scan-attendee/",
        tag: Tag.STAFF,
        role: Role.STAFF,
        summary:
            "Checks in a user using their encrypted QR code token for a specified event. " +
            "Note: This is not the full hackillinois:// uri but just the QR token part.",
        body: ScanAttendeeRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The scanned user's information",
                schema: ScanAttendeeSchema,
            },
            [StatusCode.ClientErrorUnauthorized]: {
                description: "attendeeQRCode has expired",
                schema: QRExpiredErrorSchema,
            },
            [StatusCode.ClientErrorBadRequest]: [
                {
                    id: QRExpiredError.error,
                    description: "QR Code Expired",
                    schema: QRExpiredErrorSchema,
                },
                {
                    id: QRInvalidError.error,
                    description: "QR Code Invalid (not expired)",
                    schema: QRInvalidErrorSchema,
                },
                {
                    id: AlreadyCheckedInError.error,
                    description: "User already checked in",
                    schema: AlreadyCheckedInErrorSchema,
                },
            ],
            [StatusCode.ClientErrorNotFound]: {
                description: "Could not find the event to check into",
                schema: EventNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { attendeeQRCode, eventId } = req.body;

        const qrResult = decryptQRCode(attendeeQRCode);
        if (!qrResult.success) {
            return res.status(qrResult.status).json(qrResult.error);
        }
        const userId = qrResult.userId;

        // Perform check-in logic
        const checkInResult = await performCheckIn(eventId, userId);
        if (!checkInResult.success) {
            return res.status(checkInResult.status).json(checkInResult.error);
        }

        const { eventName } = checkInResult;
        const { dietaryRestrictions } = checkInResult.profile;
        return res.status(StatusCode.SuccessOK).json({
            success: true,
            userId,
            eventName,
            dietaryRestrictions,
        });
    },
);

staffRouter.get(
    "/shift/",
    specification({
        method: "get",
        path: "/staff/shift/",
        tag: Tag.STAFF,
        role: Role.STAFF,
        summary: "Gets staff shifts for the currently authenticated user",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The shifts",
                schema: ShiftsSchema,
            },
            ...PerformCheckInErrors,
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);

        const staffShift = await Models.StaffShift.findOne({ userId });

        if (!staffShift) {
            return res.status(StatusCode.SuccessOK).json({ shifts: [] });
        }

        const shiftIds = staffShift.shifts;

        const events: Event[] = await Models.Event.find({
            isStaff: true,
            eventId: { $in: shiftIds },
        });

        return res.status(StatusCode.SuccessOK).json({ shifts: events });
    },
);

staffRouter.post(
    "/shift/",
    specification({
        method: "post",
        path: "/staff/shift/",
        tag: Tag.STAFF,
        role: Role.ADMIN,
        summary: "Sets the shifts for a specified user",
        body: ShiftsAddRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Successfully set",
                schema: SuccessResponseSchema,
            },
            ...PerformCheckInErrors,
        },
    }),
    async (req, res) => {
        const { userId, shifts } = req.body;

        await Models.StaffShift.updateOne(
            { userId },
            {
                shifts,
            },
            { upsert: true, new: true },
        );

        return res.status(StatusCode.SuccessOK).json({ success: true });
    },
);

export default staffRouter;
