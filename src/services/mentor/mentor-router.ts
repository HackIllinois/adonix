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
    MentorProfile,
    MentorProfileCreateRequestSchema,
    MentorProfileSchema,
} from "./mentor-schemas";
import { z } from "zod";
import { SuccessResponseSchema } from "../../common/schemas";
import { getAuthenticatedUser } from "../../common/auth";
import { AlreadyCheckedInError, AlreadyCheckedInErrorSchema } from "../user/user-schemas";

const mentorRouter = Router();

mentorRouter.post(
    "/info/",
    specification({
        method: "post",
        path: "/mentor/info/",
        tag: Tag.MENTOR,
        role: Role.STAFF,
        summary: "Creates a mentor profile",
        body: MentorProfileCreateRequestSchema,
        responses: {
            [StatusCode.SuccessCreated]: {
                description: "The created mentor profile",
                schema: MentorProfileSchema,
            },
        },
    }),
    async (req, res) => {
        const { name, description } = req.body;
        const mentorId = crypto.randomBytes(Config.MENTOR_BYTES_GEN).toString("hex");
        const mentorProfile: MentorProfile = {
            mentorId,
            name,
            description,
        };

        const created = await Models.MentorProfile.create(mentorProfile);
        return res.status(StatusCode.SuccessCreated).send(created);
    },
);

mentorRouter.get(
    "/info/",
    specification({
        method: "get",
        path: "/mentor/info/",
        tag: Tag.MENTOR,
        role: Role.USER,
        summary: "Gets all mentor profiles",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The mentor profiles",
                schema: z.array(MentorProfileSchema),
            },
        },
    }),
    async (_req, res) => {
        const mentors = await Models.MentorProfile.find().sort({ name: 1 });
        return res.status(StatusCode.SuccessOK).send(mentors);
    },
);

mentorRouter.put(
    "/info/:id/",
    specification({
        method: "put",
        path: "/mentor/info/{id}/",
        tag: Tag.MENTOR,
        role: Role.STAFF,
        summary: "Updates a mentor profile",
        parameters: z.object({
            id: MentorIdSchema,
        }),
        body: MentorProfileCreateRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The updated mentor profile",
                schema: MentorProfileSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Failed to find the mentor requested",
                schema: MentorNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: mentorId } = req.params;
        const { name, description } = req.body;

        const updated = await Models.MentorProfile.findOneAndUpdate({ mentorId }, { name, description }, { new: true });
        if (!updated) {
            return res.status(StatusCode.ClientErrorNotFound).send(MentorNotFoundError);
        }

        return res.status(StatusCode.SuccessOK).send(updated);
    },
);

mentorRouter.delete(
    "/info/:id/",
    specification({
        method: "delete",
        path: "/mentor/info/{id}/",
        tag: Tag.MENTOR,
        role: Role.STAFF,
        summary: "Deletes a mentor profile",
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
        const result = await Models.MentorProfile.findOneAndDelete({ mentorId });
        if (!result) {
            return res.status(StatusCode.ClientErrorNotFound).send(MentorNotFoundError);
        }

        return res.status(StatusCode.SuccessOK).send({ success: true });
    },
);

mentorRouter.put(
    "/:id/",
    specification({
        method: "put",
        path: "/mentor/{id}/",
        tag: Tag.MENTOR,
        role: Role.STAFF,
        summary: "Updates the specified mentor's office hours",
        parameters: z.object({
            id: MentorIdSchema,
        }),
        body: MentorCreateOfficeHoursRequest,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The updated office hours",
                schema: MentorOfficeHoursSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Failed to find the mentor requested",
                schema: MentorNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: mentorId } = req.params;
        const { mentorName, location, startTime, endTime } = req.body;

        const updatedOfficeHours = await Models.MentorOfficeHours.findOneAndUpdate(
            { mentorId },
            { mentorName, location, startTime, endTime },
            { new: true },
        );

        if (!updatedOfficeHours) {
            return res.status(StatusCode.ClientErrorNotFound).send(MentorNotFoundError);
        }

        return res.status(StatusCode.SuccessOK).send(updatedOfficeHours);
    },
);

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
