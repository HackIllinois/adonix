import { Router } from "express";
import { StatusCode } from "status-code-enum";

import Config from "../../common/config";
import specification, { Tag } from "../../middleware/specification";
import { seedFreshUsers, listSeedUsers } from "./dev-lib";
import {
    DEFAULT_SEED_COUNT,
    DEFAULT_SEED_PREFIX,
    DevDisabledError,
    DevDisabledErrorSchema,
    ListDevUsersResponseSchema,
    SeedFreshUserRequestSchema,
    SeedFreshUserResponseSchema,
} from "./dev-schemas";

const devRouter = Router();

function isDevDisabled(): boolean {
    return Config.PROD;
}

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
