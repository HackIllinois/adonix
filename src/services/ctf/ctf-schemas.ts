import { prop, index } from "@typegoose/typegoose";
import { z } from "zod";
import { CreateErrorAndSchema } from "../../common/schemas";

export const CTF_START_TIME = new Date("2026-02-28T13:00:00-06:00"); // Saturday 2/28 1:00 PM CT
export const CTF_END_TIME = new Date("2026-02-28T14:00:00-06:00"); // Saturday 2/28 2:00 PM CT

export class Flag {
    @prop({ required: true, unique: true })
    public flagId: string;

    @prop({ required: true })
    public flag: string;

    @prop({ required: true, default: 0 })
    public points: number;
}

@index({ userId: 1, flagId: 1 }, { unique: true })
export class FlagsClaimed {
    @prop({ required: true, index: true })
    public userId: string;

    @prop({ required: true, index: true })
    public flagId: string;

    @prop({ required: true, default: Date.now })
    public claimedAt: Date;
}

export const FlagSchema = z
    .object({
        flagId: z.string(),
        flag: z.string(),
        points: z.number(),
    })
    .openapi("CTF", {
        example: {
            flagId: "flag1",
            flag: "hackctf{flag1-example_flag}",
            points: 10,
        },
    });

export const FlagCreateRequestSchema = FlagSchema.openapi("FlagCreateRequest", {
    example: {
        flagId: "flag1",
        flag: "hackctf{flag1-example_flag}",
        points: 10,
    },
});

export type FlagCreateRequest = z.infer<typeof FlagCreateRequestSchema>;

export const [FlagNotFoundError, FlagNotFoundErrorSchema] = CreateErrorAndSchema({
    error: "FlagNotFound",
    message: "Failed to find flag",
});

export const [CTFSolveFailedError, CTFSolveFailedErrorSchema] = CreateErrorAndSchema({
    error: "CTFSolveFailed",
    message: "The submitted flag is incorrect",
});

export const [CTFAlreadyClaimedError, CTFAlreadyClaimedErrorSchema] = CreateErrorAndSchema({
    error: "AlreadyClaimed",
    message: "You've already claimed this flag",
});

export const [CTFNotActiveError, CTFNotActiveErrorSchema] = CreateErrorAndSchema({
    error: "CTFNotActive",
    message: "CTF is not currently active",
});
