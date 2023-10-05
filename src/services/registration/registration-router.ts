import { Router, Request, Response } from "express";

import Constants from "../../constants.js";
import { strongJwtVerification } from "../../middleware/verify-jwt.js";

import { JwtPayload } from "../auth/auth-models.js";
import { hasElevatedPerms } from "../auth/auth-lib.js";
import { getMentor } from "./registration-lib.js";
import { MentorSchema, RegistrationDB } from "./registration-schemas.js";
import { Collection, Document } from "mongodb";
import databaseClient from "../../database.js";
import { MentorFormat } from "./registration-formats.js";

const registrationRouter: Router = Router();

registrationRouter.get("/mentor/:USERID", strongJwtVerification, async (req: Request, res: Response) => {
	// If no target user, just GET
	if (!req.params.USERID) {
		res.redirect("/mentor/");
	}

	const targetMentor: string = req.params.USERID ?? "";
	// Get payload, and check if authorized
	const payload: JwtPayload = res.locals.payload as JwtPayload;
	if (payload.id == targetMentor || hasElevatedPerms(payload)) {
		// Authorized -> return the Mentor
		await getMentor(targetMentor).then((mentor: MentorSchema) => {
			res.status(Constants.SUCCESS).send(mentor);
		}).catch((error:string) => {
			res.status(Constants.INTERNAL_ERROR).send(error);
		});
	} else {
		res.status(Constants.FORBIDDEN).send({ error: "No Valid Auth Provided" });
	}
});

registrationRouter.get("/mentor/", strongJwtVerification, async (_ : Request, res: Response ):Promise<void> => {
	const payload: JwtPayload = res.locals.payload as JwtPayload;
	console.log(payload);
	try {
		const mentor: MentorSchema = await getMentor(payload.id);
		res.status(Constants.SUCCESS).send(mentor);
	} catch (error) {
		if (error == "MentorNotFound") {
			res.status(Constants.BAD_REQUEST).send("MentorNotFound");
		}
		//console.log("Reached");
		res.status(Constants.INTERNAL_ERROR).send("InternalError");
	}
});

registrationRouter.post("/mentor/", strongJwtVerification, async (req: Request, res: Response):Promise<Response> => {
	const token: JwtPayload = res.locals.payload as JwtPayload;

	if (!hasElevatedPerms(token)) {
		return res.status(Constants.FORBIDDEN).send({ error: "InvalidPermissions" });
	}
	const mentorData: MentorFormat = req.body as MentorFormat;
	if (token && token.id) {
		mentorData.id = token.id;
	}
	if (!mentorData.id || !mentorData.email || !mentorData.firstName || !mentorData.lastName || !mentorData.github || !mentorData.linkedin) {
		return res.status(Constants.BAD_REQUEST).send({ error: "InvalidParams" });
	}

	const collection: Collection<Document> = databaseClient.db(Constants.REGISTRATION_DB).collection(RegistrationDB.MENTORS);

	try {
		await collection.insertOne(mentorData);
		return res.status(Constants.SUCCESS).send({ ...mentorData });
	} catch (error) {
		console.log(error);
		return res.status(Constants.INTERNAL_ERROR).send({ error: "DatabaseError" });
	}

});

export default registrationRouter;


