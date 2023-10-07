import { Request, Response } from "express";

// Type for arbitrary async REST handler type
export type apiFunction = (
    request: Request,
    response: Response,
) => Promise<void>;

/**
 * Check if a string falls in a set of regex patterns
 * @param target String to verify
 * @param patterns Array of regex patterns to check against
 * @returns Whether or not the string fits AT LEAST one of the patterns
 */
export function regexPasses(target: string, patterns: RegExp[]): boolean {
    return patterns.some((pattern: RegExp) => {
        return pattern.test(target);
    });
}
