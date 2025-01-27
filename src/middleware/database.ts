// import Config from "../common/config";
// import { Request, Response, NextFunction } from "express";
// import mongoose from "mongoose";

// let initialized = false;

// export default async function (_req: Request, _res: Response, next: NextFunction): Promise<void> {
//     if (!initialized || Config.TEST) {
//         initialized = true;
//         const uri = `${Config.DB_URL}${Config.DB_PARAMS}`;
//         await mongoose.connect(uri).catch((e) => {
//             initialized = false;
//             throw e;
//         });
//     }
//     next();
// }


// Updated database middleware (database.ts)
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Config from "../common/config";

let initialized = false;

export default async function (
    req: Request | { conn?: mongoose.Connection },
    _res: Response,
    next: NextFunction
): Promise<void> {
    if (!initialized || Config.TEST) {
        initialized = true;
        const uri = `${Config.DB_URL}${Config.DB_PARAMS}`;
        await mongoose.connect(uri).catch((e) => {
            initialized = false;
            throw e;
        });
    }
    
    // For socket.io connections, store connection on the request-like object
    if (!(req as any).conn) {
        (req as any).conn = mongoose.connection;
    }
    
    next();
}