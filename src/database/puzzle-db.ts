import { prop } from "@typegoose/typegoose";

export class PuzzleItem {
    @prop({ required: true })
    public userId: string;

    @prop({ required: true })
    public teamName: string;

    @prop({ required: true })
    public lastCorrect: number;

    @prop({
        required: true,
        type: () => Boolean,
    })
    public problemComplete: boolean[];

    constructor(userId: string, teamName: string, lastCorrect: number, problemComplete: boolean[]) {
        this.userId = userId;
        this.teamName = teamName;
        this.lastCorrect = lastCorrect;
        this.problemComplete = problemComplete;
    }
}
