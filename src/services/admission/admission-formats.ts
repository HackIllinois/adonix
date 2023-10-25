export interface ApplicantDecisionFormat {
    _id?: string;
    userId: string;
    name: string;
    status: DecisionStatus;
}
export interface UpdateEntries {
    entries: ApplicantDecisionFormat[];
}

export enum DecisionStatus {
    TBD = "TBD",
    ACCEPTED = "ACCEPTED",
    REJECTED = "REJECTED",
    WAITLISTED = "WAITLISTED",
}
