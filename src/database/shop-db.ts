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

    @prop({ required: true })
    public imageURL: string;

    @prop({ required: true })
    public quantity: number;

    @prop({
        required: true,
        type: () => {
            return String;
        },
    })
    public instances: string[];

    constructor(
        itemId: string,
        name: string,
        price: number,
        isRaffle: boolean,
        imageURL: string,
        quantity: number,
        instances: string[],
    ) {
        this.itemId = itemId;
        this.name = name;
        this.price = price;
        this.isRaffle = isRaffle;
        this.imageURL = imageURL;
        this.quantity = quantity;
        this.instances = instances;
    }
}
