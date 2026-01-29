import { prop } from "@typegoose/typegoose";
import { z } from "zod";

export class AttendeeTeam {
    @prop({ required: true, unique: true })
    public name: string;

    @prop({ required: true, default: 0 })
    public points: number;

    @prop({ required: true, default: 0 })
    public members: number;
}

export const AttendeeTeamSchema = z
    .object({
        id: z.string().optional().openapi({ example: "6717efb83b5d4c1a2e47a7e1" }),
        name: z.string().openapi({ example: "Team 1" }),
        points: z.number().openapi({ example: 6700 }),
        members: z.number().openapi({ example: 67 }),
    })
    .openapi("AttendeeTeam", {
        description: "Represents a team assigned to attendees.",
    });

export const CreateAttendeeTeamRequestSchema = AttendeeTeamSchema.omit({ id: true, points: true, members: true }).openapi(
    "CreateAttendeeTeamRequest",
    {
        example: {
            name: "Team 1",
        },
    },
);

export type CreateAttendeeTeamRequest = z.infer<typeof CreateAttendeeTeamRequestSchema>;
