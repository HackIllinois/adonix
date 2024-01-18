import { NextFunction, Request, Response } from "express";

import S3 from "aws-sdk/clients/s3.js";
import Config from "../config.js";

export function s3ClientMiddleware(_: Request, res: Response, next: NextFunction): void {
    console.log("im middleware s3");
    res.locals.s3 = new S3({
        apiVersion: "2006-03-01",
        accessKeyId: Config.S3_ACCESS_KEY,
        secretAccessKey: Config.S3_SECRET_KEY,
        region: Config.S3_REGION,
        signatureVersion: "v4",
    });

    next();
}
