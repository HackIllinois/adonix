import { DecisionResponse, DecisionStatus } from "database/admission-db.js";

export interface ApplicantDecisionFormat {
    userId: string;
    status: DecisionStatus;
    response: DecisionResponse;
    reviewer: string;
    emailSent: false;
    admittedPro?: false;
}
