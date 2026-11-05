import multer from "multer";
import { NextFunction, Request, RequestHandler, Response } from "express";
import { StatusCode } from "status-code-enum";
import Config from "../common/config";
import { APIError } from "../common/schemas";

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: Config.MAX_CHALLENGE_PLAN_SIZE_BYTES,
        files: 1,
    },
    fileFilter: (_req: Request, file: Express.Multer.File, cb) => {
        // Browsers sometimes send an empty or generic mimetype for .json files, so also accept by extension.
        // Rejected files are dropped (req.file stays undefined) so the route can return a clear 400.
        const isJson = file.mimetype === "application/json" || file.originalname.toLowerCase().endsWith(".json");
        cb(null, isJson);
    },
});

/** Accepts a single .json file upload in `field`, kept in memory at req.file. */
export function singleJsonFile(field: string): RequestHandler {
    const handler = upload.single(field);
    return (req: Request, res: Response, next: NextFunction) => {
        handler(req, res, (err: unknown) => {
            if (err instanceof multer.MulterError) {
                const status =
                    err.code === "LIMIT_FILE_SIZE" ? StatusCode.ClientErrorPayloadTooLarge : StatusCode.ClientErrorBadRequest;
                return next(new APIError("BadUpload", err.message, status));
            }
            return next(err);
        });
    };
}
