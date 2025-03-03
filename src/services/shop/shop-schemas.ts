import { prop, modelOptions, Severity } from "@typegoose/typegoose";
import { z } from "zod";
import { CreateErrorAndSchema, UserIdSchema } from "../../common/schemas";

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

@modelOptions({ options: { allowMixed: Severity.ALLOW } })
export class ShopHistory {
    @prop({ required: true, index: true })
    public userId: string;

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

export const ShopRaffleWinnerSchema = z.object({
    userId: UserIdSchema,
});

export const OrderSchema = z
    .object({
        userId: UserIdSchema,
        items: z.record(z.number()).openapi({
            example: {
                item1: 32,
                item3: 5,
            },
        }),
    })
    .openapi("Order");

export const OrderQRCodeSchema = z
    .object({
        QRCode: z.string(),
    })
    .openapi("OrderQRCode", {
        example: { QRCode: "hackillinois://user?qr=3e7eea9a-7264-4ddf-877d-9e004a888eda" },
    });

export const OrderRedeemRequestSchema = z
    .object({
        QRCode: z.string(),
    })
    .openapi("OrderRedeemRequest", {
        example: { QRCode: "3e7eea9a-7264-4ddf-877d-9e004a888eda" },
        description: "The QR code token. Note: This is not the full hackillinois:// uri but just the QR token part.",
    });

export const OrderRedeemSchema = z
    .object({
        userId: UserIdSchema,
        items: z.array(
            z.object({
                itemId: ShopItemIdSchema,
                name: z.string().openapi({ example: "Cool Item" }),
                quantity: z.number().openapi({ example: 5 }),
            }),
        ),
    })
    .openapi("OrderRedeem");

export const [ShopItemAlreadyExistsError, ShopItemAlreadyExistsErrorSchema] = CreateErrorAndSchema({
    error: "AlreadyExists",
    message: "An item with that id already exists, did you mean to update it instead?",
});

export const [ShopItemNotFoundError, ShopItemNotFoundErrorSchema] = CreateErrorAndSchema({
    error: "NotFound",
    message: "Shop item not found!",
});

export const [ShopInsufficientFundsError, ShopInsufficientFundsErrorSchema] = CreateErrorAndSchema({
    error: "InsufficientFunds",
    message: "You don't have enough points to purchase that item!",
});

export const [ShopInsufficientQuantityError, ShopInsufficientQuantityErrorSchema] = CreateErrorAndSchema({
    error: "InsufficientQuantity",
    message: "Not enough of that item in the shop!",
});
