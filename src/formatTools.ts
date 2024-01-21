export function isBoolean(value: unknown): boolean {
    return typeof value === "boolean";
}

export function isNumber(value: unknown): boolean {
    return typeof value === "number";
}

export function isString(value: unknown): boolean {
    return typeof value === "string";
}

export function isArrayOfType(arr: unknown[], typeChecker: (value: unknown) => boolean): boolean {
    return Array.isArray(arr) && arr.every(typeChecker);
}

// Only works on STRING key-value enums
export function isEnumOfType(value: unknown, enumValue: object): boolean {
    for (const key of Object.keys(enumValue)) {
        if (isNumber(key)) {
            throw Error("Only string key-value enums supported");
        }
    }
    return isString(value) && Object.values(enumValue).includes(value);
}
