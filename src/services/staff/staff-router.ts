import { Router } from "express";
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
        const result = await performCheckIn(eventId, userId);
        if (!result.success) {
            return res.status(result.status).json(result.error);
        }

        // Get registration data
        const registrationData = await Models.RegistrationApplication.findOne({ userId }).select("dietaryRestrictions");
        if (!registrationData) {
            throw Error("No registration data");
        }

        const { dietaryRestrictions } = registrationData;
        return res.status(StatusCode.SuccessOK).json({
            success: true,
            userId,
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
