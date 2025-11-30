// POST /registration/
// ➡️ send confirmation email to the email provided in application

import { Router } from "express";
import { StatusCode } from "status-code-enum";
import { Role } from "../auth/auth-schemas";
import { sendMail } from "./mail-lib";
import specification, { Tag } from "../../middleware/specification";
import { MailInfoSchema, MailSendResultsSchema } from "./mail-schemas";

const mailRouter = Router();

mailRouter.post(
    "/send/",
    specification({
        method: "post",
        path: "/mail/send/",
        tag: Tag.MAIL,
        role: Role.ADMIN,
        summary: "Sends an email",
        description:
            "**WARNING**: This endpoint is not very well documented, so make sure you know what you're doing before you use it directly.",
        body: MailInfoSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The upload url",
                schema: MailSendResultsSchema,
            },
        },
    }),
    async (req, res) => {
        const mailInfo = req.body;

        const result = await sendMail(mailInfo);
        return res.status(StatusCode.SuccessOK).json(result);
    },
);

export default mailRouter;
