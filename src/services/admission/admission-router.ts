import { Router, Request, Response } from "express";
import { strongJwtVerification } from "../../middleware/verify-jwt.js";

import { JwtPayload } from "../auth/auth-models.js";
import { DecisionInfo } from "../../database/decision-db.js";
import Models from "../../database/models.js";
import Constants from "../../constants.js";
import { hasElevatedPerms } from "../auth/auth-lib.js";
import { UpdateEntries } from "./admission-formats.js";
import * as console from "console";

const admissionRouter: Router = Router();


admissionRouter.get("/", strongJwtVerification, async (_: Request, res: Response) => {
    const token: JwtPayload = res.locals.payload as JwtPayload;
    if (!hasElevatedPerms(token)) {
        return res.status(Constants.FORBIDDEN).send({ error: "InvalidToken" });
    }
    try {
        const filteredEntries: DecisionInfo[] = await Models.DecisionInfo.find({ emailSent: false });
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
            const updatedDecision: DecisionInfo | null = await Models.DecisionInfo.findOneAndUpdate(
                { userId: entry.userId },
                {$set: {status: entry.status}}
            );
            if (updatedDecision?.status != entry.status) {
                return res.status(Constants.INTERNAL_ERROR).send({ error: "NotUpdated" });
            }
        }
        return res.status(Constants.SUCCESS).send({ message: "StatusSuccess" });
    } catch (error) {
        console.log(error);
    }
    return res.status(Constants.INTERNAL_ERROR).send("InternalError");
});
export default admissionRouter;
