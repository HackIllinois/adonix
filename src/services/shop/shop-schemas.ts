import { prop } from "@typegoose/typegoose";
import { z } from "zod";
import { CreateErrorAndSchema } from "../../common/schemas";

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
        type: () => String,
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

export class ShopOrder {
    @prop({ required: true })
    public orderNum: number
    @prop({ required: true })
    public items: Array<string>

    @prop({ required: true })
    public quantity: Array<number>

    constructor(
        orderNum: number,
        items: Array<string>,
        quantity: Array<number>,
    ) {
        this.orderNum = orderNum;
        this.items = items;
        this.quantity = quantity;
    }
}

export const ShopItemIdSchema = z.string().openapi("ShopItemId", { example: "item1234" });
// export const ShopOrderArraySchema = z
// .tuple([
//   z.array(z.string()),
//   z.array(z.number()),
// ])
// .openapi("ShopOrderArray", { example: [["item1234", "item5678"], [1, 2]] });

export const ShopItemSchema = z
    .object({
        itemId: ShopItemIdSchema,
        name: z.string(),
        price: z.number(),
        isRaffle: z.boolean(),
        quantity: z.number(),
        imageURL: z.string(),
    })
    .openapi("ShopItem", {
        example: {
            itemId: "1234",
            name: "HackIllinois Branded Hoodie",
            price: 15,
            isRaffle: true,
            quantity: 1,
            imageURL: "https://raw.githubusercontent.com/HackIllinois/example/avatars/bunny.svg",
        },
    });

export const ShopItemsSchema = z.array(ShopItemSchema).openapi("ShopItems");

export const ShopItemCreateRequestSchema = ShopItemSchema.omit({
    itemId: true,
}).openapi("ShopItemCreateRequest", {
    example: {
        name: "HackIllinois Branded Hoodie",
        price: 15,
        isRaffle: true,
        quantity: 1,
        imageURL: "https://raw.githubusercontent.com/HackIllinois/example/avatars/bunny.svg",
    },
});

export const ShopItemUpdateRequestSchema = ShopItemSchema.omit({ itemId: true })
    .partial({
        imageURL: true,
        isRaffle: true,
        price: true,
        name: true,
        quantity: true,
    })
    .openapi("ShopItemUpdateRequest", {
        example: {
            name: "New Name",
        },
    });

export const ShopItemQRCodeSchema = z.string().openapi("ShopItemQRCode", {
    example: "hackillinois://item?itemId=item1234&instance=1x3",
});

export const ShopItemQRCodesSchema = z
    .object({
        itemId: ShopItemIdSchema,
        qrInfo: z.array(ShopItemQRCodeSchema),
    })
    .openapi("ShopItemQRCodes");

export const ShopItemBuyRequestSchema = z.object({
    itemId: ShopItemIdSchema,
    instance: z.string().openapi({ example: "1x3" }),
});

// needs to have list of items and quantity
export const ShopItemGenerateOrderSchema = z.object({
    items: z.array(z.string()),
    quantity: z.array(z.number()),
});

export const ShopItemFulfillOrderSchema = z.object({
    orderNum: z.number(),
});

export const OrderQRCodeSchema = z.string().openapi("OrderQRCode", {
    example: "hackillinois://ordernum?orderNum=10",
});

export const OrderQRCodesSchema = z
    .object({
        qrInfo: z.string(OrderQRCodeSchema),
    })
    .openapi("OrderQRCodes");

export const SuccessSchema = z.object({
    message: z.string(),
}).openapi("Success");

export const [ShopItemAlreadyExistsError, ShopItemAlreadyExistsErrorSchema] = CreateErrorAndSchema({
    error: "AlreadyExists",
    message: "An item with that id already exists, did you mean to update it instead?",
});

export const [ShopItemNotFoundError, ShopItemNotFoundErrorSchema] = CreateErrorAndSchema({
    error: "NotFound",
    message: "Failed to find item",
});

export const [ShopInsufficientFundsError, ShopInsufficientFundsErrorSchema] = CreateErrorAndSchema({
    error: "InsufficientFunds",
    message: "You don't have enough to purchase that item!",
});
