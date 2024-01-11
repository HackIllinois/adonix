import { Degree, Gender, HackInterest, HackOutreach, Race } from "./registration-models.js";

export interface RegistrationFormat {
    userId: string;
    isProApplicant: boolean;
    considerForGeneral?: boolean;
    preferredName: string;
    legalName: string;
    email: string;
    gender: Gender;
    race: Race[];
    requestedTravelReimbursement: boolean;
    location: string;
    degree: Degree;
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

function isString(value: unknown): boolean {
    return typeof value === "string";
}

function isBoolean(value: unknown): boolean {
    return typeof value === "boolean";
}

function isNumber(value: unknown): boolean {
    return typeof value === "number";
}

function isArrayOfType(arr: unknown[], typeChecker: (value: unknown) => boolean): boolean {
    return Array.isArray(arr) && arr.every(typeChecker);
}

export function isValidRegistrationFormat(registration: RegistrationFormat): boolean {
    console.log("A");
    if (!registration) {
        return false;
    }

    console.log("B");

    if (!isString(registration.preferredName) || !isString(registration.legalName) || !isString(registration.email)) {
        return false;
    }
    console.log("C");

    if (
        !isString(registration.gender) ||
        !isArrayOfType(registration.race, isString) ||
        !isArrayOfType(registration.dietaryRestrictions, isString)
    ) {
        return false;
    }
    console.log("D");

    if (
        !isString(registration.location) ||
        !isString(registration.degree) ||
        !isString(registration.university) ||
        !isNumber(registration.gradYear)
    ) {
        return false;
    }
    console.log("E");

    if (!isArrayOfType(registration.hackInterest, isString) || !isArrayOfType(registration.hackOutreach, isString)) {
        return false;
    }

    console.log("F");
    if (!isString(registration.hackEssay1) || !isString(registration.hackEssay2)) {
        return false;
    }

    console.log("G");
    if (!isBoolean(registration.isProApplicant) || !isBoolean(registration.requestedTravelReimbursement)) {
        return false;
    }

    console.log("H");
    if (registration.optionalEssay && !isString(registration.optionalEssay)) {
        return false;
    }

    console.log("I");
    if (registration.isProApplicant && (!isString(registration.proEssay) || !isBoolean(registration.considerForGeneral))) {
        return false;
    }

    console.log("J");
    if (!registration.isProApplicant) {
        if (isString(registration.proEssay) && (registration.proEssay?.length ?? 0) > 0) {
            return false;
        }

        if (isBoolean(registration.considerForGeneral) && registration.considerForGeneral) {
            return false;
        }
    }
    console.log("K");
    return true;
}
