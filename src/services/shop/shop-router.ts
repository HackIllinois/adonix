import crypto from "crypto";
import {
    ShopInsufficientFundsError,
    ShopInsufficientFundsErrorSchema,
    ShopItem,
    ShopItemAlreadyExistsError,
    ShopItemAlreadyExistsErrorSchema,
    ShopItemBuyRequestSchema,
    ShopItemCreateRequestSchema,
    ShopItemIdSchema,
    ShopItemNotFoundError,
    ShopItemNotFoundErrorSchema,
    ShopItemQRCodesSchema,
    ShopItemSchema,
    ShopItemsSchema,
    ShopItemUpdateRequestSchema,
    ShopItemGenerateOrderSchema,
    ShopItemFulfillOrderSchema,
    SuccessSchema,
    ShopOrder,
    OrderQRCodesSchema,
} from "./shop-schemas";
import { Router } from "express";
import { StatusCode } from "status-code-enum";
import Config from "../../common/config";
import Models from "../../common/models";
import { JwtPayload, Role } from "../auth/auth-schemas";
import { updateCoins } from "../profile/profile-lib";
import specification, { Tag } from "../../middleware/specification";
import { z } from "zod";
import { SuccessResponseSchema } from "../../common/schemas";

const shopRouter = Router();
shopRouter.get(
    "/",
    specification({
        method: "get",
        path: "/shop/",
        tag: Tag.SHOP,
        role: null,
        summary: "Gets all the shop items available",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The shop items",
                schema: ShopItemsSchema,
            },
        },
    }),
    async (_req, res) => {
        const shopItems: ShopItem[] = await Models.ShopItem.find();

        const withoutInstances = shopItems.map((item: ShopItem) => ({
            itemId: item.itemId,
            name: item.name,
            price: item.price,
            isRaffle: item.isRaffle,
            quantity: item.quantity,
            imageURL: item.imageURL,
        }));

        return res.status(StatusCode.SuccessOK).send(withoutInstances);
    },
);

shopRouter.post(
    "/item",
    specification({
        method: "post",
        path: "/shop/item/",
        tag: Tag.SHOP,
        role: null,
        summary: "Creates a shop item",
        body: ShopItemCreateRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The new item",
                schema: ShopItemSchema,
            },
            [StatusCode.ClientErrorConflict]: {
                description: "The item already exists",
                schema: ShopItemAlreadyExistsErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const details = req.body;
        const itemId = "item" + parseInt(crypto.randomBytes(Config.SHOP_BYTES_GEN).toString("hex"), 16);
        const instances = Array.from({ length: details.quantity }, (_, index) => getRand(index));

        const shopItem: ShopItem = {
            ...details,
            itemId: itemId,
            instances: instances,
        };

        // Ensure that item doesn't already exist before creating
        const itemExists = (await Models.ShopItem.findOne({ name: details.name })) ?? false;
        if (itemExists) {
            return res.status(StatusCode.ClientErrorConflict).send(ShopItemAlreadyExistsError);
        }

        const newItem = await Models.ShopItem.create(shopItem);
        const withoutInstances = {
            ...newItem.toObject(),
            instances: undefined,
        };

        return res.status(StatusCode.SuccessOK).send(withoutInstances);
    },
);

shopRouter.put(
    "/item/:id/",
    specification({
        method: "put",
        path: "/shop/item/{id}/",
        tag: Tag.SHOP,
        role: Role.ADMIN,
        summary: "Updates a shop item",
        parameters: z.object({
            id: ShopItemIdSchema,
        }),
        body: ShopItemUpdateRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The new item",
                schema: ShopItemSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Item doesn't exist",
                schema: ShopItemNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: itemId } = req.params;
        const updateRequest = req.body;

        const updatedItem = await Models.ShopItem.findOneAndUpdate({ itemId }, updateRequest, {
            new: true,
        });

        if (!updatedItem) {
            return res.status(StatusCode.ClientErrorNotFound).send(ShopItemNotFoundError);
        }

        const withoutInstances = {
            ...updatedItem.toObject(),
            instances: undefined,
        };

        return res.status(StatusCode.SuccessOK).send(withoutInstances);
    },
);

shopRouter.delete(
    "/item/:id/",
    specification({
        method: "delete",
        path: "/shop/item/{id}/",
        tag: Tag.SHOP,
        role: Role.ADMIN,
        summary: "Deletes a shop item",
        parameters: z.object({
            id: ShopItemIdSchema,
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Successfully deleted",
                schema: SuccessResponseSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Item doesn't exist",
                schema: ShopItemNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: itemId } = req.params;
        const deleted = await Models.ShopItem.deleteOne({ itemId });

        if (deleted.deletedCount == 0) {
            return res.status(StatusCode.ClientErrorNotFound).send(ShopItemNotFoundError);
        }

        return res.status(StatusCode.SuccessOK).send({ success: true });
    },
);

shopRouter.get(
    "/item/qr/:id/",
    specification({
        method: "get",
        path: "/shop/item/qr/{id}/",
        tag: Tag.SHOP,
        role: null,
        summary: "Gets the QR codes for a shop item",
        parameters: z.object({
            id: ShopItemIdSchema,
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The qr codes",
                schema: ShopItemQRCodesSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Item doesn't exist",
                schema: ShopItemNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: itemId } = req.params;

        const item = await Models.ShopItem.findOne({ itemId });

        if (!item) {
            return res.status(StatusCode.ClientErrorNotFound).send(ShopItemNotFoundError);
        }

        const uris = item.instances.map((instance: string) => `hackillinois://item?itemId=${itemId}&instance=${instance}`);
        return res.status(StatusCode.SuccessOK).send({ itemId, qrInfo: uris });
    },
);


//MINE
shopRouter.post(
    "/item/generateorder",
    specification({
        method: "post",
        path: "/shop/item/generateorder/",
        tag: Tag.SHOP,
        role: null,
        summary: "Generates an order and returns a qr code",
        body: ShopItemGenerateOrderSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The qr codes",
                schema: OrderQRCodesSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Item doesn't exist",
                schema: ShopItemNotFoundErrorSchema,
            },
            [StatusCode.ClientErrorBadRequest]: {
                description: "Not enough quantity in shop",
                schema: ShopInsufficientFundsErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const body = req.body;
        const items = body.items;
        const quantity = body.quantity;

        //const payload = res.locals.payload as JwtPayload;
        //const userId = payload.id;

        //check if enough quantity in shop
        for(let i = 0; i < items.length; i++) {
            //items[i] is the _id of the items
            const item = await Models.ShopItem.findOne({ itemId: items[i] });

            if (!item) {
                return res.status(StatusCode.ClientErrorNotFound).send(ShopItemNotFoundError);
            }

            const q = quantity?.[i] as number | undefined;
            if(q == undefined || item.quantity < q) {
                return res.status(StatusCode.ClientErrorNotFound).send(ShopInsufficientFundsError);
            }
        }

        //check if user has enough coins
        /*
        var currPrice = 0;
        for(let i = 0; i < items.length; i++) {
            const item = await Models.ShopItem.findOne({ itemId: items[i] });
            if (!item) {
                return res.status(StatusCode.ClientErrorNotFound).send(ShopItemNotFoundError);
            }

            currPrice += item.price;
            
            const profile = await Models.AttendeeProfile.findOne({ userId: userId });
            if (!profile) {
                throw Error("Could not find attendee profile");
            }

            if (profile.coins < currPrice) {
                return res.status(StatusCode.ClientErrorBadRequest).send(ShopInsufficientFundsError);
            }
        }
        */

        //have availability of all item and user has enough coins so can generate qr code with order number
        const { v4: uuidv4 } = require('uuid');
        const order = uuidv4();
        const qrCodeUrl = `hackillinois://ordernum?orderNum=${order}`;

        const shopOrder: ShopOrder = {
            orderNum: order,
            items: items,
            quantity: quantity,
            userId: "userId",
        };

        await Models.ShopOrder.create(shopOrder);

        return res.status(StatusCode.SuccessOK).send({ qrInfo: qrCodeUrl });
    },
);

//MINE
shopRouter.post(
    "/item/fulfillorder",
    specification({
        method: "post",
        path: "/shop/item/fulfillorder/",
        tag: Tag.SHOP,
        role: null,
        summary: "Purchases the order",
        body: ShopItemFulfillOrderSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The successfully purchased order",
                schema: SuccessSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Order doesn't exist",
                schema: ShopItemNotFoundErrorSchema,
            },
            [StatusCode.ClientErrorBadRequest]: {
                description: "Not enough quantity in shop",
                schema: ShopInsufficientFundsErrorSchema,
            },
        },
    }),
    async (req, res) => {
        // when qr code is scanned, will call this so body needs to have order num and then i use that
        // to get the order and then for each item in the order, subtract the quantity and then return success
        const body = req.body;
        const num = body.orderNum;
        
        const order = await Models.ShopOrder.findOne({ orderNum: num });

        if(!order) {
            return res.status(StatusCode.ClientErrorNotFound).send(ShopItemNotFoundError);
        }
        /*
        const profile = await Models.AttendeeProfile.findOne({ userId: order.userId });
        if (!profile) {
            throw Error("Could not find attendee profile");
        }
        */

        for(let i = 0; i < order.items.length; i++) {

            const item = await Models.ShopItem.findOne({ itemId: order.items[i] });

            if(!item) {
                return res.status(StatusCode.ClientErrorNotFound).send(ShopItemNotFoundError);
            }

            const q = order.quantity?.[i] as number | 0;

            if(q == undefined || item.quantity < q) {
                return res.status(StatusCode.ClientErrorNotFound).send(ShopInsufficientFundsError);
            }
        }

        for(let i = 0; i < order.items.length; i++) {
            const item = await Models.ShopItem.findOne({ itemId: order.items[i] });

            if(!item) {
                return res.status(StatusCode.ClientErrorNotFound).send(ShopItemNotFoundError);
            }

            const q = order.quantity?.[i] as number | 0;

            const updatedItem = await Models.ShopItem.findOneAndUpdate({ itemId: order.items[i] }, body, {
                quantity: item.quantity - q,
            });

            if (!updatedItem) {
                return res.status(StatusCode.ClientErrorNotFound).send(ShopItemNotFoundError);
            }

            //update coins in user
            //await updateCoins(order.userId, -item.price).then(console.error);
        }

        return res.status(StatusCode.SuccessOK).json({ message: "success" });
    },
);


shopRouter.post(
    "/item/buy",
    specification({
        method: "post",
        path: "/shop/item/buy/",
        tag: Tag.SHOP,
        role: Role.ATTENDEE,
        summary: "Purchases a shop item",
        body: ShopItemBuyRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The successfully purchased item",
                schema: ShopItemSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Item doesn't exist",
                schema: ShopItemNotFoundErrorSchema,
            },
            [StatusCode.ClientErrorBadRequest]: {
                description: "Insufficient funds",
                schema: ShopInsufficientFundsErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const itemId = req.body.itemId as string;
        const payload = res.locals.payload as JwtPayload;
        const userId = payload.id;

        const item = await Models.ShopItem.findOne({ itemId: itemId });

        if (!item) {
            return res.status(StatusCode.ClientErrorNotFound).send(ShopItemNotFoundError);
        }

        const profile = await Models.AttendeeProfile.findOne({ userId: userId });

        if (!profile) {
            throw Error("Could not find attendee profile");
        }

        if (profile.coins < item.price) {
            return res.status(StatusCode.ClientErrorBadRequest).send(ShopInsufficientFundsError);
        }

        const instances = item.instances;

        for (let i = 0; i < instances.length; ++i) {
            // If this isn't the instance, move on
            if (instances[i] != req.body.instance) {
                continue;
            }

            // delete shop item
            const updatedShopQuantity = await Models.ShopItem.updateOne(
                { itemId: itemId },
                {
                    $inc: { quantity: -1 },
                    $pull: { instances: req.body.instance },
                },
            );

            // decrement attendee coins
            if (updatedShopQuantity) {
                await updateCoins(userId, -item.price).then(console.error);
            }

            const withoutInstances = {
                ...item.toObject(),
                instances: undefined,
            };

            return res.status(StatusCode.SuccessOK).send(withoutInstances);
        }

        return res.status(StatusCode.ClientErrorNotFound).send(ShopItemNotFoundError);
    },
);

function getRand(index: number): string {
    const hash = crypto.createHash("sha256").update(`${Config.JWT_SECRET}|${index}`).digest("hex");
    return hash;
}

export default shopRouter;
