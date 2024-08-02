import Config from "../config";
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";

let initialized = false;

export default async function (_req: Request, _res: Response, next: NextFunction): Promise<void> {
    if (!initialized || Config.TEST) {
        initialized = true;
        const uri = `${Config.DB_URL}${Config.DB_PARAMS}`;
        await mongoose.connect(uri);
    }
    next();
}
