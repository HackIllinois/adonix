import { prop } from "@typegoose/typegoose";
import { z } from "zod";

export class AttendeeTeam {
    @prop({ required: true, unique: true })
    public name: string;

    @prop({ required: true })
    public badge: string;

    @prop({ required: true, default: 0 })
    public points: number;

    @prop({ required: true, default: 0 })
    public members: number;
}

export const AttendeeTeamSchema = z
    .object({
        id: z.string().optional(),
        name: z.string(),
        badge: z.string(),
        points: z.number(),
        members: z.number(),
    })
    .openapi("AttendeeTeam", {
        example: {
            id: "6717efb83b5d4c1a2e47a7e1",
            name: "Team 1",
            badge: "https://raw.githubusercontent.com/HackIllinois/adonix-metadata/main/teamBadges/team1.png",
            points: 6700,
            members: 67,
        },
    });

export const CreateAttendeeTeamRequestSchema = AttendeeTeamSchema.omit({ id: true, points: true, members: true }).openapi(
    "CreateAttendeeTeamRequest",
    {
        example: {
            name: "Team 1",
            badge: "https://raw.githubusercontent.com/HackIllinois/adonix-metadata/main/teamBadges/team1.png",
        },
    },
);

export type CreateAttendeeTeamRequest = z.infer<typeof CreateAttendeeTeamRequestSchema>;
