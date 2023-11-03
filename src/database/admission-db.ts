import { prop } from "@typegoose/typegoose";

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

    @prop({ required: true })
    public response: DecisionResponse;

    @prop({ required: true })
    public reviewer: string;

    @prop({ required: true })
    public emailSent: boolean;
}
