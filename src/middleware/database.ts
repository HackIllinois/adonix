import Config from "../config.js";
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";

let initialized = false;

export default async function (_req: Request, _res: Response, next: NextFunction): Promise<void> {
    if (!initialized) {
        initialized = true;
        await mongoose.connect(Config.DB_URL);
    }
    next();
}
