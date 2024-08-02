import passport from "passport";
import { NextFunction } from "express-serve-static-core";
import express, { Request, Response, Router } from "express";
import GitHubStrategy, { Profile as GithubProfile } from "passport-github";
import { Strategy as GoogleStrategy, Profile as GoogleProfile } from "passport-google-oauth20";

import Config, { Device } from "../../config";
import { StatusCode } from "status-code-enum";
import { strongJwtVerification } from "../../middleware/verify-jwt";
import { SelectAuthProvider } from "../../middleware/select-auth";

import { ModifyRoleRequest } from "./auth-formats";
import { JwtPayload, ProfileData, Provider, Role, RoleOperation } from "./auth-models";
import {
    generateJwtToken,
    getJwtPayloadFromProfile,
    getRoles,
    hasElevatedPerms,
    updateRoles,
    verifyFunction,
    getUsersWithRole,
    hasAdminPerms,
} from "./auth-lib";
import Models from "../../database/models";
import { RouterError } from "../../middleware/error-handler";

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

const authRouter: Router = Router();
authRouter.use(express.urlencoded({ extended: false }));

authRouter.get("/dev/", (req: Request, res: Response, next: NextFunction) => {
    const token: string | undefined = req.query.token as string | undefined;
    if (!token) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "NoToken"));
    }

    return res.status(StatusCode.SuccessOK).send({ Authorization: token });
});

/**
 * @api {get} /auth/login/github/ GET /auth/login/github/
 * @apiGroup Auth
 * @apiDescription Perform Github authentication for an attendee.
 *
 * @apiQuery {String} device=web Type of the device to be passed in, can take on "web", "ios", and "android", but defaults to web.
 *
 * @apiSuccess (200: Success) {String} token JWT token of authenticated user
 * @apiSuccessExample Example Success Response:
 *     HTTP/1.1 200 OK
 *     {"token": "loremipsumdolorsitamet"}
 
 * @apiError (400: Bad Request) {String} InvalidData User profile doesn't have enough data for JWT
 * @apiError (400: Bad Request) {String} BadDevice An invalid device was passed in.
 * @apiError (401: Unauthorized) {String} FailedAuth Invalid input passed in (missing name or email)
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 400 Bad Request
 *     {"error": "InvalidParams"}
 */
authRouter.get("/login/github/", (req: Request, res: Response, next: NextFunction) => {
    const device: string = (req.query.device as string | undefined) ?? Config.DEFAULT_DEVICE;

    if (device && !Config.REDIRECT_URLS.has(device)) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "BadDevice"));
    }
    return SelectAuthProvider("github", device)(req, res, next);
});

/**
 * @api {get} /auth/login/google/ GET /auth/login/google/
 * @apiGroup Auth
 * @apiDescription Perform Google authentication for a staff member.
 *
 * @apiQuery {String} device=web Type of the device to be passed in, can take on "web", "ios", and "android", but defaults to web.
 *
 * @apiSuccess (200: Success) {String} token JWT token of authenticated user
 * @apiSuccessExample Example Success Response:
 *     HTTP/1.1 200 OK
 *     {"token": "loremipsumdolorsitamet"}
 *
 * @apiError (400: Bad Request) {String} BadDevice An invalid device was passed in.
 * @apiError (400: Bad Request) {String} InvalidData User profile doesn't have enough data for JWT
 * @apiError (401: Unauthorized) {String} FailedAuth Invalid input passed in (missing name or email)
 * @apiErrorExample Example Error Response:
 *     HTTP/1.1 400 Bad Request
 *     {"error": "InvalidParams"}
 */
authRouter.get("/login/google/", (req: Request, res: Response, next: NextFunction) => {
    const device: string = (req.query.device as string | undefined) ?? Config.DEFAULT_DEVICE;

    if (device && !Config.REDIRECT_URLS.has(device)) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "BadDevice"));
    }
    return SelectAuthProvider("google", device)(req, res, next);
});

authRouter.get(
    "/:PROVIDER/callback/:DEVICE",
    (req: Request, res: Response, next: NextFunction) => {
        const provider: string = req.params.PROVIDER ?? "";
        try {
            const device = req.params.DEVICE;

            if (!device || !Config.REDIRECT_URLS.has(device)) {
                throw Error(`Bad device ${device}`);
            }

            res.locals.device = device;
            return SelectAuthProvider(provider, device)(req, res, next);
        } catch (error) {
            const message = error instanceof Error ? error.message : `${error}`;
            return next(new RouterError(undefined, undefined, undefined, message));
        }
    },
    async (req: Request, res: Response, next: NextFunction) => {
        if (!req.isAuthenticated()) {
            return next(new RouterError(StatusCode.ClientErrorUnauthorized, "FailedAuth"));
        }

        try {
            const device: string = (res.locals.device ?? Config.DEFAULT_DEVICE) as string;
            const user: GithubProfile | GoogleProfile = req.user as GithubProfile | GoogleProfile;
            const data: ProfileData = user._json as ProfileData;
            const redirect: string = Config.REDIRECT_URLS.get(device) ?? Config.REDIRECT_URLS.get(Config.DEFAULT_DEVICE)!;

            data.id = data.id ?? user.id;
            data.displayName = data.name ?? data.displayName ?? data.login;

            // Load in the payload with the actual values stored in the database
            const payload: JwtPayload = await getJwtPayloadFromProfile(user.provider, data, true);

            const userId: string = payload.id;
            await Models.UserInfo.findOneAndUpdate(
                { userId: userId },
                { email: data.email, name: data.displayName, userId: userId },
                { upsert: true },
            );

            let token: string;
            switch (device) {
                case Device.CHALLENGE:
                    token = generateJwtToken(payload, false, "720h");
                    break;
                case Device.ANDROID:
                    token = generateJwtToken(payload, true);
                    break;
                case Device.IOS:
                    token = generateJwtToken(payload, true);
                    break;
                case Device.PUZZLE:
                    token = generateJwtToken(payload, true);
                    break;
                default:
                    token = generateJwtToken(payload, false);
            }

            const url: string = `${redirect}?token=${token}`;
            return res.redirect(url);
        } catch (error) {
            return next(new RouterError(StatusCode.ClientErrorBadRequest, "InvalidData", undefined, error));
        }
    },
);

/**
 * @api {get} /auth/roles/list/:ROLE GET /auth/roles/list/:ROLE
 * @apiGroup Auth
 * @apiDescription Get all users that have a certain role.
 *
 * @apiParam ROLE Role to get the user for. Roles: USER, APPLICANT, ATTENDEE, VOLUNTEER, STAFF, ADMIN, MENTOR, SPONSOR
 *
 * @apiSuccess (200: Success) {String[]} Array of ids of users w/ the specified role.
 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
 *		"data" : ["github44122133", "github22779056", "github5997469", "github98075854"]
 * 	}
 *
 * @apiUse strongVerifyErrors
 */
authRouter.get("/roles/list/:ROLE", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const role = req.params.ROLE as string;
    const payload = res.locals.payload as JwtPayload;

    if (!hasElevatedPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "Forbidden"));
    }

    return await getUsersWithRole(role)
        .then((users: string[]) => res.status(StatusCode.SuccessOK).send({ userIds: users }))
        .catch((error: Error) => {
            const message = error instanceof Error ? error.message : `${error}`;
            return next(new RouterError(StatusCode.ClientErrorBadRequest, "UnknownError", undefined, message));
        });
});

/**
 * @api {get} /auth/roles/ GET /auth/roles/
 * @apiGroup Auth
 * @apiDescription Get the roles of a user from the database, provided that there is a JWT token and the token contains VALID credentials for the operation.
 *
 * @apiSuccess (200: Success) {String} id ID of the user in the request token payload.
 * @apiSuccess (200: Success) {String[]} roles Roles of the user, from the database.
 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
 *		"id": "provider0000001",
 * 		"roles": ["Admin", "Staff", "Mentor"]
 * 	}
 *
 * @apiUse strongVerifyErrors
 */
authRouter.get("/roles/", strongJwtVerification, async (_: Request, res: Response, next: NextFunction) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;
    const targetUser: string = payload.id;

    await getRoles(targetUser)
        .then((roles: Role[] | undefined) => {
            if (roles === undefined) {
                return next(new RouterError(StatusCode.ClientErrorNotFound, "UserNotFound"));
            }
            return res.status(StatusCode.SuccessOK).send({ id: targetUser, roles: roles });
        })
        .catch((error: Error) => {
            const message = error instanceof Error ? error.message : `${error}`;
            return next(new RouterError(undefined, undefined, undefined, message));
        });
});

/**
 * @api {get} /auth/roles/:USERID/ GET /auth/roles/:USERID/
 * @apiGroup Auth
 * @apiDescription Get the roles of a user, provided that there is a JWT token and the token contains VALID credentials for the operation.
 *
 * @apiParam {String} USERID Target user to get the roles of. Defaults to the user provided in the JWT token, if no user provided.
 *
 * @apiSuccess (200: Success) {String} id User ID.
 * @apiSuccess (200: Success) {String[]} roles Roles of the target user.
 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
 *		"id": "provider0000001",
 * 		"roles": ["Admin", "Staff", "Mentor"]
 * 	}
 *
 * @apiUse strongVerifyErrors
 * @apiError (400: Bad Request) {String} UserNotFound User doesn't exist in the database.
 * @apiError (403: Forbidden) {String} Forbidden API accessed by user without valid perms.
 */
authRouter.get("/roles/:USERID", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const targetUser: string = req.params.USERID as string;

    const payload: JwtPayload = res.locals.payload as JwtPayload;

    // Cases: Target user already logged in, auth user is admin
    if (payload.id == targetUser) {
        return res.status(StatusCode.SuccessOK).send({ id: payload.id, roles: payload.roles });
    } else if (hasElevatedPerms(payload)) {
        try {
            const roles: Role[] | undefined = await getRoles(targetUser);

            if (roles === undefined) {
                return next(new RouterError(StatusCode.ClientErrorNotFound, "UserNotFound"));
            }

            return res.status(StatusCode.SuccessOK).send({ id: targetUser, roles: roles });
        } catch (error) {
            const message = error instanceof Error ? error.message : `${error}`;
            return next(new RouterError(undefined, undefined, undefined, message));
        }
    } else {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "Forbidden"));
    }
});

/**
 * @api {put} /auth/roles/:OPERATION/ PUT /auth/roles/:OPERATION/
 * @apiGroup Auth
 * @apiDescription Given an operation (ADD/REMOVE), perform this operation on the given user.
 *
 * @apiParam {String} OPERATION Operation to perform on the target user. MUST BE EITHER "ADD" OR "REMOVE".
 *
 * @apiSuccess (200: Success) {String} id ID of the target user.
 * @apiSuccess (200: Success) {String[]} roles Roles of the selected user, post-completion of the requested operation.
 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
 *		"id": "provider0000001",
 * 		"roles": ["Admin", "Staff", "Mentor"]
 * 	}
 *
 * @apiError (400: Bad Request) {String} UserNotFound User doesn't exist, to perform these operations on.
 * @apiError (400: Bad Request) {String} InvalidOperation Invalid (non-ADD and non-REMOVE) operation passed in.
 * @apiError (400: Bad Request) {String} InvalidRole Nonexistent role passed in.
 * @apiUse strongVerifyErrors
 */
authRouter.put("/roles/:OPERATION/", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    // Not authenticated with modify roles perms
    if (!hasAdminPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "Forbidden"));
    }

    // Parse to get operation type
    const op: RoleOperation | undefined = RoleOperation[req.params.OPERATION?.toUpperCase() as keyof typeof RoleOperation];

    // No operation - fail out
    if (!op) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "InvalidOperation"));
    }

    // Check if role to add/remove actually exists
    const data: ModifyRoleRequest = req.body as ModifyRoleRequest;

    const role: Role | undefined = Role[data.role.toUpperCase() as keyof typeof Role];
    if (!role) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "InvalidRole"));
    }

    // Try to update roles, if possible
    try {
        const newRoles: Role[] = await updateRoles(data.id, role, op);
        return res.status(StatusCode.SuccessOK).send({ id: data.id, roles: newRoles });
    } catch (error) {
        return next(new RouterError());
    }
});

/**
 * @api {get} /auth/token/refresh/ GET /auth/token/refresh/
 * @apiGroup Auth
 * @apiDescription Refresh a JWT token - payload data stays consistent, but expiration date changes.
 *
 * @apiSuccess (200: Success) {String} token New JWT token with extended expiry time.
 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
 * 		"token": "loremipsumdolorsitamet"
 * 	}
 *
 * @apiUse strongVerifyErrors
 */
authRouter.get("/token/refresh", strongJwtVerification, async (_: Request, res: Response, next: NextFunction) => {
    // Get old data from token
    const oldPayload: JwtPayload = res.locals.payload as JwtPayload;
    const data: ProfileData = {
        id: oldPayload.id,
        email: oldPayload.email,
    };

    try {
        // Generate a new payload for the token
        const newPayload: JwtPayload = await getJwtPayloadFromProfile(oldPayload.provider, data, false);

        // Create and return a new token with the payload
        const newToken: string = generateJwtToken(newPayload);
        return res.status(StatusCode.SuccessOK).send({ token: newToken });
    } catch (error) {
        const message = error instanceof Error ? error.message : `${error}`;
        return next(new RouterError(undefined, undefined, undefined, message));
    }
});

export default authRouter;
