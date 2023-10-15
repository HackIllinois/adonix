export interface UserFormat {
    userId: string;
    name: string;
    email: string;
}

export function isValidUserFormat(u: UserFormat) {
    if (typeof u.userId !== "string" || typeof u.name !== "string" || typeof u.email !== "string") {
        return false;
    }

    return true;
}