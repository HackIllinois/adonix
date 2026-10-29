import Models from "../../common/models";
import { generateJwtToken } from "../../common/auth";
import { Provider, Role } from "../auth/auth-schemas";
import { UserInfo } from "../user/user-schemas";
import { DEFAULT_SEED_COUNT, DEFAULT_SEED_PREFIX, BOOT_SEED_COUNT } from "./dev-schemas";

export interface SeededUser {
    user: UserInfo;
    jwt: string;
}

const SEED_ID_PAD_WIDTH = 4; // decides the padding on how many digits we assign the githubseed user ID

export function formatSeedUserId(index: number, prefix: string = DEFAULT_SEED_PREFIX): string {
    return `${prefix}${String(index).padStart(SEED_ID_PAD_WIDTH, "0")}`;
}

function seedUserFields(userId: string): { name: string; email: string } {
    const suffix = userId.replace(/^github/, "");
    return {
        name: `Dev Seed ${suffix}`,
        email: `${userId}@example.com`,
    };
}

async function clearDownstreamData(userId: string): Promise<void> {
    await Models.RegistrationApplicationDraft.deleteMany({ userId });
    await Models.RegistrationApplicationSubmitted.deleteMany({ userId });
    await Models.AdmissionDecision.deleteMany({ userId });
    await Models.AttendeeProfile.deleteMany({ userId });
}

async function upsertSeedUser(userId: string): Promise<SeededUser> {
    const { name, email } = seedUserFields(userId);

    await Models.UserInfo.findOneAndUpdate({ userId }, { userId, name, email }, { upsert: true, new: true });
    await Models.AuthInfo.findOneAndUpdate(
        { userId },
        { userId, provider: Provider.GITHUB, roles: [Role.USER] },
        { upsert: true, new: true },
    );

    const jwt = generateJwtToken(
        {
            id: userId,
            email,
            provider: Provider.GITHUB,
            roles: [Role.USER],
        },
        false,
    );

    const user = (await Models.UserInfo.findOne({ userId }).lean()) as unknown as UserInfo;

    return { user, jwt };
}

export async function seedFreshUser(userId: string): Promise<SeededUser> {
    const seeded = await upsertSeedUser(userId);

    await clearDownstreamData(userId);

    return seeded;
}

export async function seedFreshUsers(
    count: number = DEFAULT_SEED_COUNT,
    prefix: string = DEFAULT_SEED_PREFIX,
): Promise<SeededUser[]> {
    const users: SeededUser[] = [];

    for (let index = 1; index <= count; index += 1) {
        const userId = formatSeedUserId(index, prefix);
        const seeded = await seedFreshUser(userId);
        users.push(seeded);
    }

    return users;
}

export async function listSeedUsers(prefix: string = DEFAULT_SEED_PREFIX): Promise<UserInfo[]> {
    const users = await Models.UserInfo.find({ userId: new RegExp(`^${prefix}`) })
        .sort({ userId: 1 })
        .lean();
    return users as unknown as UserInfo[];
}

export async function ensureSeedUsers(
    count: number = BOOT_SEED_COUNT,
    prefix: string = DEFAULT_SEED_PREFIX,
): Promise<SeededUser[]> {
    const users: SeededUser[] = [];

    for (let index = 1; index <= count; index += 1) {
        const userId = formatSeedUserId(index, prefix);
        const exists = await Models.UserInfo.exists({ userId });

        if (!exists) {
            users.push(await upsertSeedUser(userId));
        }
    }

    return users;
}
