// POST /registration/
// ➡️ send confirmation email to the email provided in application

import { NextFunction, Request, Response, Router } from "express";
import { strongJwtVerification } from "../../middleware/verify-jwt.js";
import { RouterError } from "../../middleware/error-handler.js";
import { StatusCode } from "status-code-enum";
import { hasElevatedPerms } from "../auth/auth-lib.js";
import { JwtPayload } from "../auth/auth-models.js";
import { MailInfoFormat, isValidMailInfo } from "./mail-formats.js";
import { sendMailWrapper } from "./mail-lib.js";

const mailRouter: Router = Router();

mailRouter.post("/send/", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    if (!hasElevatedPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "Forbidden"));
    }

    const mailInfo = req.body as MailInfoFormat;

    if (!isValidMailInfo(mailInfo)) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "BadRequest"));
    }

    return sendMailWrapper(res, next, mailInfo);
});

export default mailRouter;
