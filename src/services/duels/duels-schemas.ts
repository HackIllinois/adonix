import { prop } from "@typegoose/typegoose";

export class Player {
    @prop({ default: "" })
    public playerId: string;

    @prop({ default: 3 })
    public livesRemaining: number;

    @prop({ default: "" })
    public move: string;

    @prop({ default: 0 })
    public charges: number;
}

export class Duel {
    @prop({ required: true })
    public roomId: string;

    @prop({ type: () => Player, default: null })
    public player1: Player;

    @prop({ type: () => Player, default: null })
    public player2: Player;
}
