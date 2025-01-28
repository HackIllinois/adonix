import { prop } from "@typegoose/typegoose";

export class Duel {
    @prop({ required: true })
    public roomId: string;

    @prop({ required: true })
    public player1Id: string;

    @prop({ default: "" })
    public player2Id: string;

    @prop({ default: 3 })
    public player1LivesRemaining: number;

    @prop({ default: 3 })
    public player2LivesRemaining: number;

    @prop({ type: () => String, default: () => new Map<string, string>() })
    public moves: Map<string, string>; // Key: playerId, Value: move
}
