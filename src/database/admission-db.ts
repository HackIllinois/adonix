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

    @prop({ default: false })
    public admittedPro?: boolean;

    @prop({ default: DecisionResponse.PENDING })
    public response?: DecisionResponse;

    @prop({ default: false })
    public emailSent?: boolean;

    @prop({ default: 0 })
    public reimbursementValue?: number;
}
