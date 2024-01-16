import { AdmissionDecision, DecisionResponse } from "../../database/admission-db.js";
import Models from "../../database/models.js";

export function performRSVP(userId: string, response: DecisionResponse): Promise<AdmissionDecision | null> {
    //If current user has been accepted, update their RSVP decision to "ACCEPTED"/"DECLINED" acoordingly
    return Models.AdmissionDecision.findOneAndUpdate({ userId: userId }, { response: response }, { new: true });
}
