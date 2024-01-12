// POST /registration/
// ➡️ send confirmation email to the email provided in application

import { NextFunction, Request, Response, Router } from "express";
import { strongJwtVerification } from "../../middleware/verify-jwt.js";
import { RouterError } from "../../middleware/error-handler.js";
import { StatusCode } from "status-code-enum";
import { hasElevatedPerms } from "../auth/auth-lib.js";
import { JwtPayload } from "../auth/auth-models.js";
import { MailInfoFormat, isValidMailInfo } from "./mail-formats.js";
import { sendMail } from "./mail-lib.js";

// PUT /admission/
// ➡️ email everyone that had a decision changed from PENDING to ACCEPTED/WAITLISTED/REJECTED

// ➡️ periodically email those who were ACCEPTED but did not respond to RSVP yet (maybe 2 reminders max)

// PUT /admission/rsvp/
// ➡️ auto email confirmation to user that updated their rsvp choice (userid in JWT)

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

    return sendMail(mailInfo.templateId, mailInfo.recipients)
        .then((result) => {
            return res.status(StatusCode.SuccessOK).send(result.data);
        })
        .catch((result) => {
            return next(
                new RouterError(StatusCode.ClientErrorBadRequest, "EmailNotSent", {
                    status: result.response.status,
                    code: result.code,
                }),
            );
        });
});

export default mailRouter;
