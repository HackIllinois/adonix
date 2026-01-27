import { prop } from "@typegoose/typegoose";
import { z } from "zod";

export class AttendeeTeam {
    @prop({ required: true, unique: true })
    public name: string;

    @prop({ required: true, default: 0 })
    public points: number;
}

export const AttendeeTeamSchema = z
    .object({
        id: z.string().optional().openapi({ example: "6717efb83b5d4c1a2e47a7e1" }),
        name: z.string().openapi({ example: "Team 1" }),
        points: z.number().openapi({ example: 6700 }),
    })
    .openapi("Attendee Team", {
        description: "Represents a team assigned to attendees.",
    });

export const CreateAttendeeTeamRequestSchema = AttendeeTeamSchema.omit({ id: true, points: true }).openapi(
    "CreateAttendeeTeamRequest",
    {
        example: {
            name: "Team 1",
        },
    },
);

export type CreateAttendeeTeamRequest = z.infer<typeof CreateAttendeeTeamRequestSchema>;
