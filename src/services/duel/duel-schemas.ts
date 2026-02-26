import { prop, modelOptions } from "@typegoose/typegoose";
import { z } from "zod";
import { CreateErrorAndSchema } from "../../common/schemas";

class PendingUpdates {
    @prop({ default: [], type: () => String })
    host: string[];

    @prop({ default: [], type: () => String })
    guest: string[];
}

const PendingUpdatesSchema = z.object({
    host: z.array(z.string()),
    guest: z.array(z.string()),
});

@modelOptions({ schemaOptions: { timestamps: true } })
export class Duel {
    @prop({ required: true })
    public hostId: string;

    @prop({ required: true })
    public guestId: string;

    @prop({ required: true, default: 0 })
    public hostScore: number;

    @prop({ required: true, default: 0 })
    public guestScore: number;

    @prop({ required: true, default: false })
    public hostHasDisconnected: boolean;

    @prop({ required: true, default: false })
    public guestHasDisconnected: boolean;

    @prop({ required: true, default: false })
    public hasFinished: boolean;

    @prop({ required: true, default: false })
    public isScoringDuel: boolean;

    @prop({ required: true, type: () => PendingUpdates, default: () => ({ host: [], guest: [] }) })
    pendingUpdates: PendingUpdates;
}

export const DuelSchema = z
    .object({
        hostId: z.string(),
        guestId: z.string(),
        hostScore: z.number(),
        guestScore: z.number(),
        hostHasDisconnected: z.boolean(),
        guestHasDisconnected: z.boolean(),
        hasFinished: z.boolean(),
        isScoringDuel: z.boolean(),
        pendingUpdates: PendingUpdatesSchema,
    })
    .openapi("Duel", {
        example: {
            hostId: "google12345",
            guestId: "google67890",
            hostScore: 6,
            guestScore: 7,
            hostHasDisconnected: false,
            guestHasDisconnected: false,
            hasFinished: false,
            isScoringDuel: true,
            pendingUpdates: { host: [], guest: [] },
        },
    });

export const DuelCreateRequestSchema = DuelSchema.pick({
    hostId: true,
    guestId: true,
}).openapi("DuelCreateRequest", {
    example: {
        hostId: "google12345",
        guestId: "google67890",
    },
});

export type DuelCreateRequest = z.infer<typeof DuelCreateRequestSchema>;

export const DuelUpdateRequestSchema = DuelSchema.omit({
    hostId: true,
    guestId: true,
    pendingUpdates: true,
    isScoringDuel: true,
})
    .partial()
    .openapi("DuelUpdateRequest", {
        example: {
            hostScore: 0,
            guestScore: 1,
            hostHasDisconnected: false,
            guestHasDisconnected: false,
            hasFinished: false,
        },
    });

export type DuelUpdateRequest = z.infer<typeof DuelUpdateRequestSchema>;

export const DuelIdSchema = z.string().openapi("DuelId", { example: "duel1" });

export const [DuelNotFoundError, DuelNotFoundErrorSchema] = CreateErrorAndSchema({
    error: "DuelNotFoundError",
    message: "The requested duel was not found.",
});

export const [DuelForbiddenError, DuelForbiddenErrorSchema] = CreateErrorAndSchema({
    error: "DuelForbiddenError",
    message: "You do not have permission to perform this action.",
});
