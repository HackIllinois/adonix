import { prop } from "@typegoose/typegoose";
import { Document } from 'mongoose'; // Import Mongoose's Document interface

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

export class DecisionInfo extends Document {
    @prop({ required: true })
    public userId: string;

    @prop({ required: true })
    public status: DecisionStatus;

    @prop({ required: true })
    public response: DecisionResponse;
}

export class DecisionEntry extends Document {
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
