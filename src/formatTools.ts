export function isBoolean(value: unknown): boolean {
    return typeof value === "boolean";
}

export function isNumber(value: unknown): boolean {
    return typeof value === "number";
}

export function isString(value: unknown): boolean {
    return typeof value === "string";
}

export function isObject(value: unknown): value is object {
    return typeof value === "object";
}

export function isArrayOfType(arr: unknown[], typeChecker: (value: unknown) => boolean): boolean {
    return Array.isArray(arr) && arr.every(typeChecker);
}
