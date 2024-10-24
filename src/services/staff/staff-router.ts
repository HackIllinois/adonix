import { Router } from "express";
import { JwtPayload, Role } from "../auth/auth-schemas";
import { decodeJwtToken, getAuthenticatedUser } from "../../common/auth";
import {
    AttendanceFormat,
    CodeExpiredError,
    CodeExpiredErrorSchema,
    ScanAttendeeRequestSchema,
    ScanAttendeeSchema,
    ShiftsAddRequestSchema,
    ShiftsSchema,
} from "./staff-schemas";
import Config from "../../common/config";
import Models from "../../common/models";
import { StatusCode } from "status-code-enum";
import { Event } from "../event/event-schemas";
import { performCheckIn, PerformCheckInErrors } from "./staff-lib";
import specification, { Tag } from "../../middleware/specification";
import { SuccessResponseSchema } from "../../common/schemas";
import { EventNotFoundError, EventNotFoundErrorSchema } from "../event/event-schemas";

const staffRouter = Router();

staffRouter.post(
    "/attendance/",
    specification({
        method: "post",
        path: "/staff/attendance/",
        tag: Tag.STAFF,
        role: Role.STAFF,
        summary: "Checks the currently authenticated staff into the specified staff event",
        body: ScanAttendeeRequestSchema,
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
        const payload = res.locals.payload as JwtPayload;

        const eventId = (req.body as AttendanceFormat).eventId;
        const userId = payload.id;

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
        summary: "Checks in a user using their QR code JWT for a specified event",
        body: ScanAttendeeRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The scanned user's information",
                schema: ScanAttendeeSchema,
            },
            ...PerformCheckInErrors,
        },
    }),
    async (req, res) => {
        const { attendeeJWT, eventId } = req.body;
        const { id: userId } = decodeJwtToken(attendeeJWT);

        const result = await performCheckIn(eventId, userId);
        if (!result.success) {
            return res.status(result.status).json(result.error);
        }

        const registrationData = await Models.RegistrationApplication.findOne({ userId: userId }).select("dietaryRestrictions");
        if (!registrationData) {
            throw Error("No registration data");
        }

        const { dietaryRestrictions } = registrationData;
        return res.status(StatusCode.SuccessOK).json({ success: true, userId, dietaryRestrictions });
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
        summary: "Adds shifts for a specified user",
        body: ShiftsAddRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The shifts",
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
                $push: {
                    shifts: {
                        $each: shifts,
                    },
                },
            },
            { upsert: true, new: true },
        );

        return res.status(StatusCode.SuccessOK).json({ success: true });
    },
);

export default staffRouter;
