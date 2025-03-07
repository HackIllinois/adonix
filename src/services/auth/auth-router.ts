import passport from "passport";
import express, { Router, Request, Response } from "express";
import GitHubStrategy, { Profile as GithubProfile } from "passport-github";
import { Strategy as GoogleStrategy, Profile as GoogleProfile } from "passport-google-oauth20";

import Config, { Templates } from "../../common/config";
import { StatusCode } from "status-code-enum";
import { SelectAuthProvider } from "../../middleware/select-auth";

import {
    ProfileData,
    Provider,
    Role,
    RoleOperation,
    AuthDevSchema,
    JWTSchema,
    ProviderSchema,
    DeviceSchema,
    AuthenticationFailedError,
    AuthenticationFailedErrorSchema,
    RoleSchema,
    ListUsersByRoleSchema,
    UserRolesSchema,
    RefreshTokenSchema,
    RedirectUrlSchema,
    BadRedirectUrlErrorSchema,
    BadRedirectUrlError,
    SponsorLoginRequestSchema,
    BadCodeErrorSchema,
    BadCodeError,
    SponsorLoginSchema,
} from "./auth-schemas";
import {
    generateJwtToken,
    getJwtPayloadFromProfile,
    getRoles,
    updateRoles,
    verifyFunction,
    getUsersWithRole,
    getAuthenticatedUser,
    isValidRedirectUrl,
    generateCode,
} from "../../common/auth";
import Models from "../../common/models";
import specification, { Tag } from "../../middleware/specification";
import { z } from "zod";
import { UserNotFoundError, UserNotFoundErrorSchema } from "../user/user-schemas";
import { SuccessResponseSchema, UserIdSchema } from "../../common/schemas";
import { NextFunction } from "express-serve-static-core";
import { sendMail } from "../mail/mail-lib";
import { SponsorEmailSchema } from "../sponsor/sponsor-schemas";

passport.use(
    Provider.GITHUB,
    new GitHubStrategy(
        {
            clientID: Config.GITHUB_OAUTH_ID,
            clientSecret: Config.GITHUB_OAUTH_SECRET,
            callbackURL: Config.CALLBACK_URLS.GITHUB,
        },
        verifyFunction,
    ),
);

passport.use(
    Provider.GOOGLE,
    new GoogleStrategy(
        {
            clientID: Config.GOOGLE_OAUTH_ID,
            clientSecret: Config.GOOGLE_OAUTH_SECRET,
            callbackURL: Config.CALLBACK_URLS.GOOGLE,
        },
        verifyFunction,
    ),
);

const authRouter = Router();
authRouter.use(express.urlencoded({ extended: false }));

authRouter.get(
    "/dev/",
    specification({
        method: "get",
        path: "/auth/dev/",
        tag: Tag.AUTH,
        role: null,
        query: z.object({
            token: JWTSchema,
        }),
        summary: "A strictly dev-only callback which displays the authentication JWT",
        description: "This quite literally only outputs the passed `token` query parameter",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The authentication JWT",
                schema: AuthDevSchema,
            },
        },
    }),
    (req, res) => res.status(StatusCode.SuccessOK).send({ Authorization: `${req.query.token}` }),
);

authRouter.get(
    "/login/:provider/",
    specification({
        method: "get",
        path: "/auth/login/{provider}/",
        tag: Tag.AUTH,
        role: null,
        parameters: z.object({
            provider: ProviderSchema,
        }),
        query: z.object({
            device: z.optional(DeviceSchema),
            redirect: z.optional(RedirectUrlSchema),
        }),
        summary: "Initiates a login through an authentication provider",
        description:
            "You should redirect the browser here, and provide the device you are redirecting from. " +
            "Attendees authenticate through GitHub, and staff authenticate through Google. " +
            "The device is used to determine the url to redirect back to after authentication is successful. " +
            "For testing purposes, such as localhost, the redirect url may be provided directly instead. " +
            "It will not be accepted if it does not match the allowed redirect urls. " +
            "Note that redirect will override device if both are provided.",
        responses: {
            [StatusCode.RedirectFound]: {
                description: "Successful redirect to authentication provider",
                schema: z.object({}),
            },
            [StatusCode.ClientErrorBadRequest]: {
                description: "The redirect url requested is invalid",
                schema: BadRedirectUrlErrorSchema,
            },
        },
    }),
    (req, res, next) => {
        const { provider } = req.params;
        const device = req.query.device ?? Config.DEFAULT_DEVICE;
        const device_redirect = Config.DEVICE_TO_REDIRECT_URL.get(device);
        if (!device_redirect) {
            throw Error(`No redirect url for device ${device_redirect}`);
        }

        // Either use the redirect they ask for, or the one provided by device, or the default redirect
        const redirect = req.query.redirect ?? device_redirect;

        if (!isValidRedirectUrl(redirect)) {
            return res.status(StatusCode.ClientErrorBadRequest).send(BadRedirectUrlError);
        }

        return SelectAuthProvider(provider, redirect)(req, res, next);
    },
);

authRouter.get(
    "/:provider/callback/",
    specification({
        method: "get",
        path: "/auth/{provider}/callback/",
        tag: Tag.AUTH,
        role: null,
        parameters: z.object({
            provider: ProviderSchema,
        }),
        query: z.object({
            // Note that the redirect url is stored in state to persist when a provider calls us back with it
            state: RedirectUrlSchema,
        }),
        summary: "DO NOT CALL. Authentication providers call this after a successful authentication.",
        description:
            "**You should not ever use this directly.** " +
            "Authentication providers use this endpoint to determine where to send the authentication data.",
        responses: {
            [StatusCode.RedirectFound]: {
                description: "Successful redirect to authentication provider",
                schema: z.object({}),
            },
            [StatusCode.ClientErrorUnauthorized]: {
                description: "Authorization failed",
                schema: AuthenticationFailedErrorSchema,
            },
            [StatusCode.ClientErrorBadRequest]: {
                description: "The redirect url requested is invalid",
                schema: BadRedirectUrlErrorSchema,
            },
        },
    }),
    (req, res, next) => {
        const provider = req.params.provider ?? "";
        const redirect = req.query.state;

        if (!isValidRedirectUrl(redirect)) {
            return res.status(StatusCode.ClientErrorBadRequest).send(BadRedirectUrlError);
        }

        return SelectAuthProvider(provider, redirect)(req, res, next);
    },
    async (req, res) => {
        if (!req.isAuthenticated()) {
            return res.status(StatusCode.ClientErrorUnauthorized).json(AuthenticationFailedError);
        }

        const redirect: string = req.query.state;
        const user: GithubProfile | GoogleProfile = req.user as GithubProfile | GoogleProfile;
        const data = user._json as ProfileData;

        data.id = data.id ?? user.id;
        data.displayName = data.name ?? data.displayName ?? data.login;

        // Load in the payload with the actual values stored in the database
        const payload = await getJwtPayloadFromProfile(user.provider, data, true);

        const userId = payload.id;
        await Models.UserInfo.findOneAndUpdate(
            { userId },
            { email: data.email, name: data.displayName, userId },
            { upsert: true },
        );

        const token = generateJwtToken(payload, false);
        const url = `${redirect}?token=${token}`;
        return res.redirect(url);
    },
);
// Handle authentication errors
authRouter.use("/:provider/callback", (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("AUTH ERROR", err);
    return res.status(StatusCode.ClientErrorUnauthorized).json({
        ...AuthenticationFailedError,
        details: err,
    });
});

authRouter.post(
    "/sponsor/verify/",
    specification({
        method: "post",
        path: "/auth/sponsor/verify/",
        tag: Tag.AUTH,
        role: null,
        query: z.object({
            email: SponsorEmailSchema,
        }),
        summary: "Sends a code to a sponsor email",
        description: "For security reasons, there is no confirmation on if an email was actually sent or not",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Sent a code if the email provided was valid",
                schema: SuccessResponseSchema,
            },
        },
    }),
    async (req, res) => {
        const { email } = req.query;
        const existing = await Models.Sponsor.findOne({ email });

        if (!existing) {
            return res.status(StatusCode.SuccessOK).send({ success: true });
        }

        const GENERATED_CODE = generateCode();
        const now = Math.floor(Date.now() / Config.MILLISECONDS_PER_SECOND);
        const expiry = now + Config.SPONSOR_VERIFICATION_CODE_EXPIRY_SECONDS;

        await Models.AuthCode.findOneAndUpdate(
            { email },
            {
                code: GENERATED_CODE,
                expiry,
            },
            { upsert: true },
        );

        await sendMail({
            recipients: [email],
            templateId: Templates.SPONSOR_VERIFICATION_CODE,
            subs: {
                code: GENERATED_CODE,
            },
        });

        return res.status(StatusCode.SuccessOK).send({ success: true });
    },
);

authRouter.post(
    "/sponsor/login/",
    specification({
        method: "post",
        path: "/auth/sponsor/login/",
        tag: Tag.AUTH,
        role: null,
        body: SponsorLoginRequestSchema,
        summary: "Logs in with a code",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Successfully logged in, returns the auth token for future requests",
                schema: SponsorLoginSchema,
            },
            [StatusCode.ClientErrorForbidden]: {
                description: "The email or code sent was invalid",
                schema: BadCodeErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { email, code } = req.body;
        const existing = await Models.Sponsor.findOne({ email });
        const authCode = await Models.AuthCode.findOne({ email });

        const expired = authCode && authCode.expiry < Math.floor(Date.now() / Config.MILLISECONDS_PER_SECOND);
        const badCode = authCode && code !== authCode.code;

        if (!existing || !authCode || expired || badCode) {
            return res.status(StatusCode.ClientErrorForbidden).send(BadCodeError);
        }

        await Models.AuthCode.deleteOne({ email });

        // Load in the payload with the actual values stored in the database
        const payload = await getJwtPayloadFromProfile(
            "sponsor",
            {
                id: existing.userId,
                email,
            },
            false,
        );

        const token = generateJwtToken(payload, false);
        return res.status(StatusCode.SuccessOK).send({ token });
    },
);

authRouter.get(
    "/roles/list/:role/",
    specification({
        method: "get",
        path: "/auth/roles/list/{role}/",
        tag: Tag.AUTH,
        role: Role.STAFF,
        parameters: z.object({
            role: RoleSchema,
        }),
        summary: "Gets all users that have the specified role",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The user ids that have the specified role",
                schema: ListUsersByRoleSchema,
            },
        },
    }),
    async (req, res) => {
        const role = req.params.role;

        const userIds = await getUsersWithRole(role);

        res.status(StatusCode.SuccessOK).send({ userIds });
    },
);

authRouter.get(
    "/roles/",
    specification({
        method: "get",
        path: "/auth/roles/",
        tag: Tag.AUTH,
        role: Role.USER,
        summary: "Gets the roles of the currently authenticated user",
        description: `Possible roles: ${Object.values(Role).join(", ")}`,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The roles",
                schema: UserRolesSchema,
            },
        },
    }),
    async (req, res) => {
        const { id } = getAuthenticatedUser(req);

        const roles = (await getRoles(id)) || [];
        res.status(StatusCode.SuccessOK).send({ id, roles });
    },
);

authRouter.get(
    "/roles/:id/",
    specification({
        method: "get",
        path: "/auth/roles/{id}/",
        tag: Tag.AUTH,
        role: Role.STAFF,
        summary: "Gets the roles of the specified user",
        description:
            "Staff-only because this is used to get roles of another user. " +
            "To get the roles of the currently authenticated user, use `GET /auth/roles/` instead.",
        parameters: z.object({
            id: UserIdSchema,
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The roles",
                schema: UserRolesSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Couldn't find the user specified",
                schema: UserNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id } = req.params;

        const roles = await getRoles(id);
        if (roles === undefined) {
            return res.status(StatusCode.ClientErrorNotFound).json(UserNotFoundError);
        }

        return res.status(StatusCode.SuccessOK).send({ id, roles: roles });
    },
);

authRouter.put(
    "/roles/:id/:role/",
    specification({
        method: "put",
        path: "/auth/roles/{id}/{role}/",
        tag: Tag.AUTH,
        role: Role.ADMIN,
        summary: "Adds a role to a user",
        parameters: z.object({
            id: UserIdSchema,
            role: RoleSchema,
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The updated roles",
                schema: UserRolesSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Couldn't find the user specified",
                schema: UserNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id, role } = req.params;

        const newRoles = await updateRoles(id, role, RoleOperation.ADD);
        if (!newRoles) {
            return res.status(StatusCode.ClientErrorNotFound).json(UserNotFoundError);
        }

        return res.status(StatusCode.SuccessOK).send({ id, roles: newRoles });
    },
);

authRouter.delete(
    "/roles/:id/:role/",
    specification({
        method: "delete",
        path: "/auth/roles/{id}/{role}/",
        tag: Tag.AUTH,
        role: Role.ADMIN,
        summary: "Removes a role from a user",
        parameters: z.object({
            id: UserIdSchema,
            role: RoleSchema,
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The updated roles",
                schema: UserRolesSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Couldn't find the user specified",
                schema: UserNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id, role } = req.params;

        const newRoles = await updateRoles(id, role, RoleOperation.REMOVE);
        if (!newRoles) {
            return res.status(StatusCode.ClientErrorNotFound).json(UserNotFoundError);
        }

        return res.status(StatusCode.SuccessOK).send({ id, roles: newRoles });
    },
);

authRouter.get(
    "/token/refresh",
    specification({
        method: "get",
        path: "/auth/token/refresh/",
        tag: Tag.AUTH,
        role: Role.USER,
        summary: "Gets a new authorization token with a reset expiry",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The new refreshed token",
                schema: RefreshTokenSchema,
            },
        },
    }),
    async (req, res) => {
        // Get old data from token
        const oldPayload = getAuthenticatedUser(req);
        const data = {
            id: oldPayload.id,
            email: oldPayload.email,
        };

        // Generate a new payload for the token
        const newPayload = await getJwtPayloadFromProfile(oldPayload.provider, data, false);

        // Create and return a new token with the payload
        const newToken = generateJwtToken(newPayload);
        return res.status(StatusCode.SuccessOK).send({ token: newToken });
    },
);

export default authRouter;
