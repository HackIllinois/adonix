import { Degree, Gender, HackInterest, HackOutreach, Race } from "./registration-models";
import { isString, isBoolean, isArrayOfType, isNumber, isEnumOfType } from "../../common/formatTools";

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
        console.log("ERROR: userId, preferredName, legalName, emailAddress", registration);
        return false;
    }

    if (
        !isEnumOfType(registration.gender, Gender) ||
        !isArrayOfType(registration.race, (value) => isEnumOfType(value, Race)) ||
        !isArrayOfType(registration.dietaryRestrictions, isString || undefined)
    ) {
        console.log("ERROR: gender, race, dietaryRestrictions", registration);
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
        console.log("ERROR: location, degree, university, gradYear, major, minor", registration);
        return false;
    }

    if (
        !isArrayOfType(registration.hackInterest, (value) => isEnumOfType(value, HackInterest)) ||
        !isArrayOfType(registration.hackOutreach, (value) => isEnumOfType(value, HackOutreach))
    ) {
        console.log("ERROR: hackInterest, hackOutreach", registration);
        return false;
    }

    if (!isString(registration.hackEssay1) || !isString(registration.hackEssay2)) {
        console.log("ERROR: hackEssay1, hackEssay2", registration);
        return false;
    }

    if (!isBoolean(registration.isProApplicant) || !isBoolean(registration.requestedTravelReimbursement)) {
        console.log("ERROR: isProApplicant, requestedTravelReimbursement", registration);
        return false;
    }

    if (registration.optionalEssay && !isString(registration.optionalEssay)) {
        console.log("ERROR: optionalEssay", registration);
        return false;
    }

    if (
        registration.isProApplicant &&
        (registration.proEssay === null ||
            !isString(registration.proEssay) ||
            registration.considerForGeneral === null ||
            !isBoolean(registration.considerForGeneral))
    ) {
        console.log("ERROR: proEssay, considerForGeneral", registration);
        return false;
    }

    // just realized this checks the same thing as above
    // if (registration.isProApplicant) {
    //     if (registration.proEssay === null || !isString(registration.proEssay)) {
    //         return false;
    //     }

    //     if (registration.considerForGeneral === null || !isBoolean(registration.considerForGeneral)) {
    //         return false;
    //     }
    // }

    return true;
}
