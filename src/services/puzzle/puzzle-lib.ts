import Config from "../../config.js";
import Models from "../../database/models.js";
import { PuzzleItem } from "database/puzzle-db.js";
import { UpdateQuery } from "mongoose";

/**
 * Change's user puzzle.
 * @param userId ID of the user to modify
 * @param qid QuestionId (0-indexed) that was correctly submitted
 * @returns Promise containing the puzzle
 */
export async function updatePuzzle(userId: string, qid: number): Promise<PuzzleItem | null> {
    const updateQuery: UpdateQuery<PuzzleItem> = {
        $set: {
            lastCorrect: Math.floor(Date.now() / Config.MILLISECONDS_PER_SECOND),
            [`problemComplete.${qid}`]: true,
        },
        $inc: {
            score: 1,
        },
    };

    return Models.PuzzleItem.findOneAndUpdate({ userId: userId }, updateQuery, { new: true, upsert: true });
}
