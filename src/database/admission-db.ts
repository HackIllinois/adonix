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
    public admittedPro?: boolean;

    @prop({ required: true })
    public response: DecisionResponse;

    @prop({ required: true })
    public reviewer: string;

    @prop({ required: true })
    public emailSent: boolean;

    constructor(
        userId: string,
        status: DecisionStatus,
        response: DecisionResponse,
        reviewer: string,
        emailSent: boolean,
        admittedPro?: boolean,
    ) {
        this.userId = userId;
        this.status = status;
        this.admittedPro = admittedPro;
        this.response = response;
        this.reviewer = reviewer;
        this.emailSent = emailSent;
    }
}
