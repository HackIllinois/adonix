import { Degree, Gender, HackInterest, HackOutreach, Race } from "./registration-models.js";
import { isString, isBoolean, isArrayOfType, isNumber, isEnumOfType } from "../../formatTools.js";

export interface RegistrationFormat {
    userId: string;
    isProApplicant: boolean;
    considerForGeneral?: boolean;
    resumeFileName?: string;
    preferredName: string;
    legalName: string;
    emailAddress: string;
    gender: Gender;
    race: Race[];
    requestedTravelReimbursement: boolean;
    location: string;
    degree: Degree;
    major: string;
    minor?: string;
    university: string;
    gradYear: number;
    hackInterest: HackInterest[];
    hackOutreach: HackOutreach[];
    dietaryRestrictions: string[];
    hackEssay1: string;
    hackEssay2: string;
    optionalEssay?: string;
    proEssay?: string;
}

export function isValidRegistrationFormat(registration: RegistrationFormat): boolean {
    if (!registration) {
        return false;
    }

    if (
        !isString(registration.userId) ||
        !isString(registration.preferredName) ||
        !isString(registration.legalName) ||
        !isString(registration.emailAddress)
    ) {
        return false;
    }

    if (
        !isEnumOfType(registration.gender, Gender) ||
        !isArrayOfType(registration.race, (value) => isEnumOfType(value, Race)) ||
        !isArrayOfType(registration.dietaryRestrictions, isString || undefined)
    ) {
        return false;
    }

    if (
        !isString(registration.location) ||
        !isEnumOfType(registration.degree, Degree) ||
        !isString(registration.university) ||
        !(isNumber(registration.gradYear) || registration.gradYear == undefined) ||
        !isString(registration.major) ||
        !isString(registration.minor ?? "")
    ) {
        return false;
    }

    if (
        !isArrayOfType(registration.hackInterest, (value) => isEnumOfType(value, HackInterest)) ||
        !isArrayOfType(registration.hackOutreach, (value) => isEnumOfType(value, HackOutreach))
    ) {
        return false;
    }

    if (!isString(registration.hackEssay1) || !isString(registration.hackEssay2)) {
        return false;
    }

    if (!isBoolean(registration.isProApplicant) || !isBoolean(registration.requestedTravelReimbursement)) {
        return false;
    }

    if (registration.optionalEssay && !isString(registration.optionalEssay)) {
        return false;
    }

    if (registration.isProApplicant && (!isString(registration.proEssay) || !isBoolean(registration.considerForGeneral))) {
        return false;
    }

    if (registration.isProApplicant) {
        if (registration.proEssay !== null || !isString(registration.proEssay)) {
            return false;
        }

        if (registration.considerForGeneral !== null || !isBoolean(registration.considerForGeneral)) {
            return false;
        }
    }

    return true;
}
