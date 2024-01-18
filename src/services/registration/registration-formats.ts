import { Degree, Gender, HackInterest, HackOutreach, Race } from "./registration-models.js";
import { isString, isBoolean, isArrayOfType, isNumber } from "../../formatTools.js";

export interface RegistrationFormat {
    userId: string;
    isProApplicant: boolean;
    considerForGeneral?: boolean;
    preferredName: string;
    legalName: string;
    emailAddress: string;
    gender: Gender;
    race: Race[];
    requestedTravelReimbursement: boolean;
    location: string;
    degree: Degree;
    major: string,
    minor?: string,
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

    console.log("_");

    if (
        !isString(registration.userId) ||
        !isString(registration.preferredName) ||
        !isString(registration.legalName) ||
        !isString(registration.emailAddress)
    ) {
        return false;
    }
    console.log("A");
    if (
        !isString(registration.gender) ||
        !isArrayOfType(registration.race, isString) ||
        !isArrayOfType(registration.dietaryRestrictions, isString)
    ) {
        return false;
    }

    console.log("B");

    if (
        !isString(registration.location) ||
        !isString(registration.degree) ||
        !isString(registration.university) ||
        !isNumber(registration.gradYear) ||
        !isString(registration.major) ||
        !isString(registration.minor ?? "")
    ) {
        return false;
    }

    console.log("C");

    if (!isArrayOfType(registration.hackInterest, isString) || !isArrayOfType(registration.hackOutreach, isString)) {
        return false;
    }

    console.log("D");

    if (!isString(registration.hackEssay1) || !isString(registration.hackEssay2)) {
        return false;
    }

    console.log("E");

    if (!isBoolean(registration.isProApplicant) || !isBoolean(registration.requestedTravelReimbursement)) {
        return false;
    }

    console.log("F");

    if (registration.optionalEssay && !isString(registration.optionalEssay)) {
        return false;
    }

    console.log("G");

    if (registration.isProApplicant && (!isString(registration.proEssay) || !isBoolean(registration.considerForGeneral))) {
        return false;
    }

    console.log("H");

    if (!registration.isProApplicant) {
        if (isString(registration.proEssay) && (registration.proEssay?.length ?? 0) > 0) {
            return false;
        }

        if (isBoolean(registration.considerForGeneral) && registration.considerForGeneral) {
            return false;
        }
    }
    console.log("I");

    return true;
}
