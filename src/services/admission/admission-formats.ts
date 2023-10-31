import { DecisionStatus } from "database/decision-db.js";

export interface ApplicantDecisionFormat {
    userId: string;
    status: DecisionStatus;
}
