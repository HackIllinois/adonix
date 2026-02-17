import { Router } from "express";
import Models from "../../common/models";
import { StatusCode } from "status-code-enum";
import { Role } from "../auth/auth-schemas";
import { updatePoints } from "../profile/profile-lib";
import Config from "../../common/config";
import crypto from "crypto";
import specification, { Tag } from "../../middleware/specification";
import {
    MentorAttendanceRequestSchema,
    MentorAttendanceSchema,
    MentorCreateOfficeHoursRequest,
    MentorIdSchema,
    MentorNotFoundError,
    MentorNotFoundErrorSchema,
    MentorOfficeHours,
    MentorOfficeHoursSchema,
} from "./mentor-schemas";
import { z } from "zod";
import { SuccessResponseSchema } from "../../common/schemas";
import { getAuthenticatedUser } from "../../common/auth";
import { AlreadyCheckedInError, AlreadyCheckedInErrorSchema } from "../user/user-schemas";

const mentorRouter = Router();

mentorRouter.post(
    "/",
    specification({
        method: "post",
        path: "/mentor/",
        tag: Tag.MENTOR,
        role: Role.STAFF,
        summary: "Create a mentor's office hours",
        body: MentorCreateOfficeHoursRequest,
        responses: {
            [StatusCode.SuccessCreated]: {
                description: "The new office hours",
                schema: MentorOfficeHoursSchema,
            },
        },
    }),
    async (req, res) => {
        const { mentorName, location, startTime, endTime } = req.body;

        const mentorId = crypto.randomBytes(Config.MENTOR_BYTES_GEN).toString("hex");
        const officeHours: MentorOfficeHours = {
            mentorId,
            mentorName,
            location,
            startTime,
            endTime,
        };
        const newOfficeHours = await Models.MentorOfficeHours.create(officeHours);

        return res.status(StatusCode.SuccessCreated).send(newOfficeHours);
    },
);

mentorRouter.get(
    "/",
    specification({
        method: "get",
        path: "/mentor/",
        tag: Tag.MENTOR,
        role: Role.USER,
        summary: "Gets all mentor office hours",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The office hours",
                schema: z.array(MentorOfficeHoursSchema),
            },
        },
    }),
    async (_req, res) => {
        const officeHours = await Models.MentorOfficeHours.find();
        return res.status(StatusCode.SuccessOK).send(officeHours);
    },
);

mentorRouter.delete(
    "/:id/",
    specification({
        method: "delete",
        path: "/mentor/{id}/",
        tag: Tag.MENTOR,
        role: Role.STAFF,
        summary: "Deletes the specified mentor's office hours",
        parameters: z.object({
            id: MentorIdSchema,
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Successfully deleted",
                schema: SuccessResponseSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Failed to find the mentor requested",
                schema: MentorNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: mentorId } = req.params;

        const result = await Models.MentorOfficeHours.findOneAndDelete({ mentorId: mentorId });
        if (!result) {
            return res.status(StatusCode.ClientErrorNotFound).send(MentorNotFoundError);
        }

        return res.status(StatusCode.SuccessOK).send({ success: true });
    },
);

mentorRouter.post(
    "/attendance/",
    specification({
        method: "post",
        path: "/mentor/attendance/",
        tag: Tag.MENTOR,
        role: Role.ATTENDEE,
        summary: "Checks into a mentor's office hours",
        body: MentorAttendanceRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Successfully checked in, returns the points rewarded",
                schema: MentorAttendanceSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Failed to find the mentor requested",
                schema: MentorNotFoundErrorSchema,
            },
            [StatusCode.ClientErrorBadRequest]: {
                description: "Already checked in to office hours",
                schema: AlreadyCheckedInErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);
        const { mentorId } = req.body;

        const officeHours = await Models.MentorOfficeHours.findOne({ mentorId: mentorId });

        if (!officeHours) {
            return res.status(StatusCode.ClientErrorNotFound).send(MentorNotFoundError);
        }

        // Not already checked in
        if ((officeHours.attendees ?? []).includes(userId)) {
            return res.status(StatusCode.ClientErrorBadRequest).send(AlreadyCheckedInError);
        }

        const hasAttendedAnyOfficeHours = await Models.MentorOfficeHours.findOne({
            attendees: userId,
        });
        let points = 0;
        if (!hasAttendedAnyOfficeHours) {
            points = Config.MENTOR_OFFICE_HOURS_POINT_REWARD;
            await updatePoints(userId, points);
        }

        await Models.MentorOfficeHours.findOneAndUpdate(
            { mentorId: mentorId },
            { $addToSet: { attendees: userId } },
            { new: true },
        );

        return res.status(StatusCode.SuccessOK).send({ points });
    },
);

export default mentorRouter;
