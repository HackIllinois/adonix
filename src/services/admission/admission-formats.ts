import { DecisionStatus } from "database/decision-db.js";

export interface ApplicantDecisionFormat {
    _id?: string;
    userId: string;
    name: string;
    status: DecisionStatus;
}
