export function isValidUserFormat(u: UserInfo): boolean {
    if (typeof u.userId !== "string" || typeof u.name !== "string" || typeof u.email !== "string") {
        return false;
    }

    return true;
}
