import "dotenv";
import passport from "passport";
import { NextFunction } from "express-serve-static-core";
import express, { Request, Response, Router } from "express";
import GitHubStrategy, { Profile as GithubProfile } from "passport-github";
import { Profile as GoogleProfile, Strategy as GoogleStrategy } from "passport-google-oauth20";

import Constants from "../../constants.js";
import { SelectAuthProvider } from "../../middleware/select-auth.js";
import { JwtPayload, ProfileData, Provider } from "./auth-models.js";
import { generateJwtToken as generateJwtToken, getJwtPayload, verifyFunction } from "./auth-lib.js";


passport.use(Provider.GITHUB, new GitHubStrategy({
	clientID: process.env.GITHUB_OAUTH_ID ?? "",
	clientSecret: process.env.GITHUB_OAUTH_SECRET ?? "",
	callbackURL: Constants.GITHUB_OAUTH_CALLBACK,
}, verifyFunction));


passport.use(Provider.GOOGLE, new GoogleStrategy({
	clientID: process.env.GOOGLE_OAUTH_ID ?? "",
	clientSecret: process.env.GOOGLE_OAUTH_SECRET ?? "",
	callbackURL: Constants.GOOGLE_OAUTH_CALLBACK,
}, verifyFunction));


const authRouter: Router = Router();
authRouter.use(express.urlencoded({ extended: false }));


authRouter.get("/test/", (_: Request, res: Response) => {
	console.log("Received log!");
	res.end("Auth endpoint is working!");
});


authRouter.get("/:provider/", (req: Request, res: Response, next: NextFunction) => {
	const provider: string = req.params.provider ?? "";
	SelectAuthProvider(provider)(req, res, next);
});


authRouter.get("/:provider/callback/", (req: Request, res: Response, next: NextFunction) => {
	const provider: string = req.params.provider ?? "";
	SelectAuthProvider(provider)(req, res, next);
}, (req: Request, res: Response) => {
	if (req.isAuthenticated()) {
		const user: GithubProfile | GoogleProfile = req.user as GithubProfile | GoogleProfile;
		const data: ProfileData = user._json as ProfileData;
		const payload: JwtPayload = getJwtPayload(user.provider, data);
		const token: string = generateJwtToken(payload);
		res.status(Constants.SUCCESS).send({ token: token });
	} else {
		res.status(Constants.UNAUTHORIZED_REQUEST).send();
	}

	res.status(Constants.UNAUTHORIZED_REQUEST).send();
});


export default authRouter;
