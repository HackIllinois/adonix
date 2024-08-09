// POST /registration/
// ➡️ send confirmation email to the email provided in application

import { NextFunction, Request, Response, Router } from "express";
import { strongJwtVerification } from "../../middleware/verify-jwt";
import { RouterError } from "../../middleware/error-handler";
import { StatusCode } from "status-code-enum";
import { hasElevatedPerms } from "../auth/auth-lib";
import { JwtPayload } from "../auth/auth-models";
import { MailInfoFormat, isValidMailInfo } from "./mail-formats";
import { sendMailWrapper } from "./mail-lib";

const mailRouter = Router();

mailRouter.post("/send/", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const payload = res.locals.payload as JwtPayload;

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
