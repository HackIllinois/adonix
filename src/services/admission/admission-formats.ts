import { DecisionStatus } from "database/admission-db.js";

export interface ApplicantDecisionFormat {
    userId: string;
    status: DecisionStatus;
}
