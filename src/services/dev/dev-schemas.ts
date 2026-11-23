import { z } from "zod";

import { CreateErrorAndSchema } from "../../common/schemas";
import { UserInfoSchema } from "../user/user-schemas";

export const DEFAULT_SEED_PREFIX = "githubseed";
export const DEFAULT_SEED_COUNT = 1;
// eslint-disable-next-line no-magic-numbers
export const MAX_SEED_COUNT = 20;
// eslint-disable-next-line no-magic-numbers
export const BOOT_SEED_COUNT = 3;

export const SeedPrefixSchema = z
    .string()
    .regex(/^github[a-z0-9]*$/, "Prefix must start with github and contain only lowercase letters and numbers")
    .openapi("SeedPrefix", {
        description: "Prefix for seeded user ids. Must start with github so ids match the provider format.",
        example: DEFAULT_SEED_PREFIX,
    });

export const SeedFreshUserRequestSchema = z
    .object({
        count: z.number().int().min(1).max(MAX_SEED_COUNT).optional().openapi({ example: DEFAULT_SEED_COUNT }),
        prefix: SeedPrefixSchema.optional().openapi({ example: DEFAULT_SEED_PREFIX }),
    })
    .openapi("DevSeedFreshUserRequest", {
        description: "How many fresh users to seed. Empty body seeds one user with the default prefix.",
    });

export const SeededUserSchema = z
    .object({
        user: UserInfoSchema,
        jwt: z.string().openapi({ description: "JWT for the seeded user, signed with the local secret" }),
    })
    .openapi("SeededUser");

export const SeedFreshUserResponseSchema = z
    .object({
        users: z.array(SeededUserSchema),
    })
    .openapi("DevSeedFreshUserResponse", {
        description: "Freshly seeded users with tokens the debug picker can use",
    });

export const ListDevUsersResponseSchema = z
    .object({
        users: z.array(UserInfoSchema),
    })
    .openapi("DevListUsersResponse", {
        description: "Seeded users available to the local debug picker",
    });

export const DevLoginRequestSchema = z
    .object({
        userId: z
            .string()
            .optional()
            .openapi({
                description: "An existing seeded user ID. Omit to create and log in as one fresh user.",
                example: `${DEFAULT_SEED_PREFIX}0001`,
            }),
    })
    .openapi("DevLoginRequest");

export const DevLoginResponseSchema = z
    .object({
        user: UserInfoSchema,
        jwt: z.string().openapi({ description: "JWT for the logged-in seeded user" }),
    })
    .openapi("DevLoginResponse");

export const [DevDisabledError, DevDisabledErrorSchema] = CreateErrorAndSchema({
    error: "DevDisabled",
    message: "Dev endpoints are disabled in production",
});
