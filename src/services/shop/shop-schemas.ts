import { prop, modelOptions, Severity } from "@typegoose/typegoose";
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

    constructor(itemId: string, name: string, price: number, isRaffle: boolean, imageURL: string, quantity: number) {
        this.itemId = itemId;
        this.name = name;
        this.price = price;
        this.isRaffle = isRaffle;
        this.imageURL = imageURL;
        this.quantity = quantity;
    }
}

@modelOptions({ options: { allowMixed: Severity.ALLOW } })
export class ShopOrder {
    @prop({ required: true })
    public userId!: string;

    @prop({ type: Map, required: true })
    public items!: Map<string, number>;

    constructor(items: [string, number][], userId: string) {
        this.items = new Map(items);
        this.userId = userId;
    }
}

export const ShopItemIdSchema = z.string().openapi("ShopItemId", { example: "3e7eea9a-7264-4ddf-877d-9e004a888eda" });

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
            itemId: "3e7eea9a-7264-4ddf-877d-9e004a888eda",
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

export const ShopOrderInfoSchema = z.object({
    items: z.record(z.number()),
    userId: z.string(),
});

export const ShopItemFulfillOrderSchema = z.object({
    QRCode: z.string(),
});

export const OrderQRCodeSchema = z.string().openapi("OrderQRCode", {
    example: "hackillinois://user?qr=github1203919029",
});

export const OrderQRCodesSchema = z
    .object({
        qrInfo: z.string(OrderQRCodeSchema),
    })
    .openapi("OrderQRCodes");

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

export const [ShopInsufficientQuantityError, ShopInsufficientQuantityErrorSchema] = CreateErrorAndSchema({
    error: "InsufficientQuantity",
    message: "Not enough of that item in the shop/your cart",
});
