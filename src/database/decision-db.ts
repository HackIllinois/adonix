import { prop } from "@typegoose/typegoose";

enum DecisionStatus {
    TBD = "TBD",
    ACCEPTED = "ACCEPTED",
    REJECTED = "REJECTED",
    WAITLISTED = "WAITLISTED",
}

enum DecisionResponse {
    PENDING = "PENDING",
    ACCEPTED = "ACCEPTED",
    DECLINED = "DECLINED",
}

export class DecisionInfo {
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

export class DecisionEntry {
    @prop({ required: true })
    public userId: string;

    @prop({ required: true })
    public wave: number;

    @prop({ required: true })
    public reviewer: string;

    @prop({ required: true })
    public timestamp: number;

    @prop({ required: true })
    public decision: DecisionStatus;
}
