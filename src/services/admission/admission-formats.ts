export interface DecisionInfoEntry {
    _id?: string;
    userId: string;
    name: string;
    status: DecisionStatus;
}
export interface UpdateEntries {
    entries: DecisionInfoEntry[];
}
export interface DecisionInformationEntry {
    userId: string;
    status: DecisionStatus;
    response: DecisionResponse;
    reviewer: string;
    emailSent: boolean;
}
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
