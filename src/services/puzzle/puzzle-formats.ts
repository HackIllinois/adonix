import { PuzzleItem } from "../../database/puzzle-db.js";

export function isValidPuzzleItemFormat(obj: PuzzleItem): boolean {
    if (typeof obj.userId !== "string") {
        return false;
    }

    if (typeof obj.teamName !== "string") {
        return false;
    }

    if (typeof obj.lastCorrect !== "number") {
        return false;
    }

    if (!obj.problemComplete) {
        return false;
    }

    return true;
}
