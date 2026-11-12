import { Router } from "express";
import { StatusCode } from "status-code-enum";

import Config from "../../common/config";
import { generateJwtToken, getJwtCookieOptions, getJwtPayloadFromDB } from "../../common/auth";
import Models from "../../common/models";
import specification, { Tag } from "../../middleware/specification";
import { seedFreshUsers, listSeedUsers } from "./dev-lib";
import { UserNotFoundError, UserNotFoundErrorSchema } from "../user/user-schemas";
import {
    DEFAULT_SEED_COUNT,
    DEFAULT_SEED_PREFIX,
    DevDisabledError,
    DevDisabledErrorSchema,
    DevLoginRequestSchema,
    DevLoginResponseSchema,
    ListDevUsersResponseSchema,
    SeedFreshUserRequestSchema,
    SeedFreshUserResponseSchema,
} from "./dev-schemas";

const devRouter = Router();
const SEED_USER_ID_PATTERN = /^githubseed\d+$/;

function isDevDisabled(): boolean {
    return Config.PROD;
}

devRouter.post(
    "/login/",
    specification({
        method: "post",
        path: "/dev/login/",
        tag: Tag.DEV,
        role: null,
        summary: "Logs in as a local seeded user",
        description:
            "Dev only. Logs in as an existing seeded user or creates one fresh registrant when userId is omitted. " +
            "Disabled in production.",
        body: DevLoginRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Logged-in seeded user and JWT",
                schema: DevLoginResponseSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "The requested seeded user does not exist",
                schema: UserNotFoundErrorSchema,
            },
            [StatusCode.ClientErrorForbidden]: {
                description: "Dev endpoints are disabled in production",
                schema: DevDisabledErrorSchema,
            },
        },
    }),
    async (req, res) => {
        if (isDevDisabled()) {
            return res.status(StatusCode.ClientErrorForbidden).json(DevDisabledError);
        }

        let userId = req.body.userId;
        if (userId === undefined) {
            const seededUsers = await seedFreshUsers();
            const seeded = seededUsers[0];
            if (!seeded) {
                throw new Error("Expected seed helper to create one user");
            }
            userId = seeded.user.userId;
        } else if (!SEED_USER_ID_PATTERN.test(userId)) {
            return res.status(StatusCode.ClientErrorNotFound).json(UserNotFoundError);
        }

        const user = await Models.UserInfo.findOne({ userId }).lean();
        if (!user) {
            return res.status(StatusCode.ClientErrorNotFound).json(UserNotFoundError);
        }

        let payload;
        try {
            payload = await getJwtPayloadFromDB(userId);
        } catch {
            return res.status(StatusCode.ClientErrorNotFound).json(UserNotFoundError);
        }

        const jwt = generateJwtToken(payload, false);
        res.cookie("jwt", jwt, getJwtCookieOptions());

        return res.status(StatusCode.SuccessOK).send({ user, jwt });
    },
);

devRouter.post(
    "/seed/fresh-user/",
    specification({
        method: "post",
        path: "/dev/seed/fresh-user/",
        tag: Tag.DEV,
        role: null,
        summary: "Seeds fresh local users for the site debug picker",
        description:
            "Dev only. Creates users that are signed in but have no registration, RSVP, or profile. " +
            "Public in dev so it works on an empty database. Disabled in production.",
        body: SeedFreshUserRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Seeded users with JWTs",
                schema: SeedFreshUserResponseSchema,
            },
            [StatusCode.ClientErrorForbidden]: {
                description: "Dev endpoints are disabled in production",
                schema: DevDisabledErrorSchema,
            },
        },
    }),
    async (req, res) => {
        if (isDevDisabled()) {
            return res.status(StatusCode.ClientErrorForbidden).json(DevDisabledError);
        }

        const count = req.body.count ?? DEFAULT_SEED_COUNT;
        const prefix = req.body.prefix ?? DEFAULT_SEED_PREFIX;
        const users = await seedFreshUsers(count, prefix);

        return res.status(StatusCode.SuccessOK).send({ users });
    },
);

devRouter.get(
    "/users/",
    specification({
        method: "get",
        path: "/dev/users/",
        tag: Tag.DEV,
        role: null,
        summary: "Lists seeded local users for the site debug picker",
        description: "Dev only. Returns seeded users so the picker can offer them as login options.",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Seeded users",
                schema: ListDevUsersResponseSchema,
            },
            [StatusCode.ClientErrorForbidden]: {
                description: "Dev endpoints are disabled in production",
                schema: DevDisabledErrorSchema,
            },
        },
    }),
    async (_req, res) => {
        if (isDevDisabled()) {
            return res.status(StatusCode.ClientErrorForbidden).json(DevDisabledError);
        }

        const users = await listSeedUsers();

        return res.status(StatusCode.SuccessOK).send({ users });
    },
);

export default devRouter;
