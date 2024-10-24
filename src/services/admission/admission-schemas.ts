import { prop } from "@typegoose/typegoose";
import { z } from "zod";
import { CreateErrorAndSchema, UserIdSchema } from "../../common/schemas";

export enum DecisionStatus {
    TBD = "TBD",
    ACCEPTED = "ACCEPTED",
    REJECTED = "REJECTED",
    WAITLISTED = "WAITLISTED",
}

export enum DecisionResponse {
    PENDING = "PENDING",
    ACCEPTED = "ACCEPTED",
    DECLINED = "DECLINED",
}

export class AdmissionDecision {
    @prop({ required: true })
    public userId: string;

    @prop({ required: true })
    public status: DecisionStatus;

    @prop({ default: false })
    public admittedPro: boolean;

    @prop({ default: DecisionResponse.PENDING })
    public response: DecisionResponse;

    @prop({ default: false })
    public emailSent: boolean;

    @prop({ default: 0 })
    public reimbursementValue: number;
}

export const DecisionStatusSchema = z.nativeEnum(DecisionStatus);
export const DecisionResponseSchema = z.nativeEnum(DecisionResponse);

export const AdmissionDecisionSchema = z
    .object({
        userId: UserIdSchema,
        status: DecisionStatusSchema,
        admittedPro: z.boolean().openapi({ example: false }),
        response: DecisionResponseSchema,
        emailSent: z.boolean().openapi({ example: false }),
        reimbursementValue: z.number(),
    })
    .openapi("AdmissionDecision");

export const AdmissionDecisionsSchema = z.array(AdmissionDecisionSchema);

export const DecisionRequestSchema = z.enum(["accept", "decline"]);

export const [DecisionNotAcceptedError, DecisionNotAcceptedErrorSchema] = CreateErrorAndSchema({
    error: "NotAccepted",
    message: "You weren't accepted, you cannot accept/decline this decision",
});

export const [DecisionAlreadyRSVPdError, DecisionAlreadyRSVPdErrorSchema] = CreateErrorAndSchema({
    error: "AlreadyRSVPed",
    message: "You've already RSVPed!",
});

export const [DecisionNotFoundError, DecisionNotFoundErrorSchema] = CreateErrorAndSchema({
    error: "DecisionNotFound",
    message: "Couldn't find your decision!",
});
