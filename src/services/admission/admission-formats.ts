import { isArrayOfType, isBoolean, isEnumOfType, isNumber, isString } from "../../common/formatTools";
import { AdmissionDecision, DecisionResponse, DecisionStatus } from "./admission-schemas";

export function isValidApplicantFormat(obj: AdmissionDecision[]): boolean {
    return isArrayOfType(obj, isValidApplicantDecision);
}

function isValidApplicantDecision(obj: unknown): boolean {
    const decision = obj as AdmissionDecision;

    return (
        isString(decision.userId) &&
        isEnumOfType(decision.status, DecisionStatus) &&
        (decision.response === undefined || isEnumOfType(decision.response, DecisionResponse)) &&
        isBoolean(decision.emailSent) &&
        (decision.admittedPro === undefined || isBoolean(decision.admittedPro)) &&
        (decision.reimbursementValue === undefined || (isNumber(decision.reimbursementValue) && decision.reimbursementValue >= 0))
    );
}
