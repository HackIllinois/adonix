import { prop } from "@typegoose/typegoose";

export class ShopItem {
    @prop({ required: true })
    public itemId: string;

    @prop({ required: true })
    public name: string;

    @prop({ required: true })
    public price: number;

    @prop({ required: true })
    public isRaffle: boolean;

    constructor(itemId: string, name: string, price: number, isRaffle: boolean) {
        this.itemId = itemId;
        this.name = name;
        this.price = price;
        this.isRaffle = isRaffle;
    }
}

export class ShopQuantity {
    @prop({ required: true })
    public itemId: string;

    @prop({ required: true })
    public quantity: number;

    @prop({required: true})
    public secrets: number[];

    constructor(itemId: string, quantity: number, secrets: number[]) {
        this.itemId = itemId;
        this.quantity = quantity;
        this.secrets = secrets;
    }
}
