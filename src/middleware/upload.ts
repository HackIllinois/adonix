import multer from "multer";
import { Request } from "express";

const MAX_FILE_SIZE_MB = 10;
const KB = 1024;
const MB = KB * KB;

const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: {
        fileSize: MAX_FILE_SIZE_MB * MB, // 10 MB
    },
    fileFilter: (_req: Request, file: Express.Multer.File, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("Only image files are allowed"));
        }
    },
});

export default upload;
