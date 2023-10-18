import { Router, Request, Response } from "express";
import { strongJwtVerification } from "../../middleware/verify-jwt.js";

import { JwtPayload } from "../auth/auth-models.js";
import { DecisionInfo, DecisionInfoModel } from "../../database/decision-db.js";

import Constants from "../../constants.js";
import { hasElevatedPerms } from "../auth/auth-lib.js";
import { DecisionInformationEntry, UpdateEntries } from "./admission-formats.js";
const admissionRouter: Router = Router();

//FOR TESTING PURPOSES
admissionRouter.post("/", strongJwtVerification, async (req: Request, res: Response) => {
    const newEntry: DecisionInformationEntry = req.body as DecisionInformationEntry;
    try {
        await DecisionInfoModel.create(newEntry);
        return res.status(Constants.SUCCESS).send({ message: "Success!" });
    } catch (error) {
        console.log(error);
    }
    return res.status(Constants.INTERNAL_ERROR).send({ error: "InternalError" });
});

admissionRouter.get("/", strongJwtVerification, async (_: Request, res: Response) => {
    const token: JwtPayload = res.locals.payload as JwtPayload;
    if (!hasElevatedPerms(token)) {
        return res.status(Constants.FORBIDDEN).send({ error: "InvalidToken" });
    }
    try {
        const filteredEntries: DecisionInfo[] = await DecisionInfoModel.find({ emailSent: false });
        return res.status(Constants.SUCCESS).send({ entries: filteredEntries });
    } catch (error) {
        console.error(error);
    }
    return res.status(Constants.INTERNAL_ERROR).send({ error: "InternalError" });
});

admissionRouter.put("/", strongJwtVerification, async (req: Request, res: Response) => {
    const token: JwtPayload = res.locals.payload as JwtPayload;
    if (!hasElevatedPerms(token)) {
        return res.status(Constants.FORBIDDEN).send({ error: "InvalidToken" });
    }
    try {
        const updateEntries: UpdateEntries = req.body as UpdateEntries;
        for (const entry of updateEntries.entries) {
            const update = {
                status: entry.status,
            };
            const updatedDecision: DecisionInfo | null = await DecisionInfoModel.findOneAndUpdate(
                { userId: entry.userId },
                update,
            );
            if (updatedDecision?.status != entry.status) {
                return res.status(Constants.INTERNAL_ERROR).send({ error: "InternalError" });
            }
        }
        return res.status(Constants.SUCCESS).send({ message: "StatusSuccess" });
    } catch (error) {
        console.log(error);
    }
    return res.status(Constants.INTERNAL_ERROR).send("InternalError");
});
export default admissionRouter;
