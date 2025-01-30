
import crypto from "crypto";
//ShopItemBuyRequestSchema
import {
    ShopInsufficientFundsError,
    ShopInsufficientFundsErrorSchema,
    ShopInsufficientQuantityErrorSchema,
    ShopItem,
    ShopItemAlreadyExistsError,
    ShopItemAlreadyExistsErrorSchema,
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
import { Role } from "../auth/auth-schemas";
import specification, { Tag } from "../../middleware/specification";
import { z } from "zod";
import { SuccessResponseSchema } from "../../common/schemas";
import { updatePoints } from "../profile/profile-lib";
import { getAuthenticatedUser } from "../../common/auth";

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
        role: Role.ADMIN,
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

shopRouter.post(
    "/cart/redeem",
    specification({
        method: "post",
        path: "/shop/cart/redeem/",
        tag: Tag.SHOP,
        role: Role.STAFF,
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
        const num = body.userId;
        
        const order = await Models.ShopOrder.findOne({ userId: num });

        if(!order) {
            return res.status(StatusCode.ClientErrorNotFound).send(ShopItemNotFoundError);
        }

        const profile = await Models.AttendeeProfile.findOne({ userId: order.userId });
        if (!profile) {
            throw Error("Could not find attendee profile");
        }


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

            /*
            const updatedItem = await Models.ShopItem.findOneAndUpdate({ itemId: order.items[i] }, body, {
                quantity: item.quantity - q,
            });
            */

            const updatedShopQuantity = await Models.ShopItem.updateOne(
                { itemId: order.items[i] },
                {
                    $inc: { quantity: -q },
                },
            );

            if (!updatedShopQuantity) {
                return res.status(StatusCode.ClientErrorNotFound).send(ShopItemNotFoundError);
            }

            //update coins in user
            await updatePoints(order.userId, -(q*item.price)).then(console.error);
        }

        const result = await Models.ShopOrder.deleteOne({ userId: num });
        if (result.deletedCount === 0) {
            return res.status(404).json({ message: "Order not found" });
        }

        return res.status(StatusCode.SuccessOK).json({ message: "success" });
    },
);

shopRouter.post(
    "/cart/:itemId",
    specification({
        method: "post",
        path: "/shop/cart/{itemId}/",
        tag: Tag.SHOP,
        role: Role.USER,
        summary: "Adds item to users cart",
        parameters: z.object({
            itemId: ShopItemIdSchema,
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The qr codes",
                schema: SuccessSchema,
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

        const { itemId } = req.params;
        const { id: userId } = getAuthenticatedUser(req);

        var userOrder = await Models.ShopOrder.findOne({ userId: userId });
        //user doesn't have a order yet
        if(!userOrder) {
            const shopOrder: ShopOrder = {
                items: [],
                quantity: [],
                userId: userId,
            };

            await Models.ShopOrder.create(shopOrder);
            userOrder = await Models.ShopOrder.findOne({ userId: userId });
        }

        if(!userOrder){
            throw Error("Creating cart for user failed.")
        }

        //check if enough quantity in shop
        const item = await Models.ShopItem.findOne({ itemId: itemId });
        if (!item) {
            return res.status(StatusCode.ClientErrorNotFound).send(ShopItemNotFoundError);
        }

        if(item.quantity <= 0) {
            return res.status(StatusCode.ClientErrorBadRequest).send(ShopInsufficientFundsError);
        }

        //check if user has enough coins
        const profile = await Models.AttendeeProfile.findOne({ userId: userId });
        if (!profile) {
            throw Error("Could not find attendee profile");
        }

        if (profile.points < item.price) {
            return res.status(StatusCode.ClientErrorBadRequest).send(ShopInsufficientFundsError);
        }

        //add item to order or increase quantity
        const items = userOrder.items;
        var found = false;
        for(let i = 0; i < items.length; i++) {
            if(items[i] = itemId) {
                found = true;

                const updatedShopOrder = await Models.ShopOrder.updateOne(
                    { userId: userId },
                    { 
                        $inc: { [`quantity.${i}`]: 1 }
                    },
                );
                if (!updatedShopOrder) {
                    return res.status(StatusCode.ClientErrorNotFound).send(ShopItemNotFoundError);
                }
            }
        }
        if(!found) {
            const updatedShopOrder = await Models.ShopOrder.updateOne(
                { userId: userId },
                {
                    $push: {
                        items: itemId,
                        quantity: 1
                    }
                },
            );
            
            if (!updatedShopOrder) {
                return res.status(StatusCode.ClientErrorNotFound).send(ShopItemNotFoundError);
            }
        }

        return res.status(StatusCode.SuccessOK).send({ message: "success" });
    },
);

shopRouter.get(
    "/cart",
    specification({
        method: "get",
        path: "/shop/cart/",
        tag: Tag.SHOP,
        role: Role.USER,
        summary: "Returns content of users cart",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "List of items and quantity",
                schema: ShopItemGenerateOrderSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Item doesn't exist",
                schema: ShopItemNotFoundErrorSchema,
            },
            [StatusCode.ClientErrorBadRequest]: {
                description: "Not enough quantity in shop",
                schema: ShopInsufficientQuantityErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);

        //get their order from order db
        var userOrder = await Models.ShopOrder.findOne({ userId: userId });
        if(!userOrder) {
            const shopOrder: ShopOrder = {
                items: [],
                quantity: [],
                userId: userId,
            };

            await Models.ShopOrder.create(shopOrder);
            userOrder = await Models.ShopOrder.findOne({ userId: userId });
        }

        if(!userOrder) {
            throw Error("Unable to view cart.")
        }

        const items = userOrder.items;
        const quantity = userOrder.quantity;

        //check if enough quantity in shop
        //Dont need to check
        /*
        for(let i = 0; i < items.length; i++) {
            const item = await Models.ShopItem.findOne({ itemId: items[i] });

            if (!item) {
                return res.status(StatusCode.ClientErrorNotFound).send(ShopItemNotFoundError);
            }

            const q = quantity?.[i] as number | undefined;
            if(q == undefined || item.quantity < q) {
                return res.status(StatusCode.ClientErrorBadRequest).send(ShopInsufficientQuantityError);
            }
        }
        */

        return res.status(StatusCode.SuccessOK).send({ items: items, quantity: quantity});
    },
);


shopRouter.get(
    "/cart/qr",
    specification({
        method: "get",
        path: "/shop/cart/qr/",
        tag: Tag.SHOP,
        role: Role.USER,
        summary: "Returns qr code of users cart",
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
        const { id: userId } = getAuthenticatedUser(req);

        const userOrder = await Models.ShopOrder.findOne({ userId: userId });
        if(!userOrder) {
            throw Error("no order");
        }
        const items = userOrder.items;
        const quantity = userOrder.quantity;
        //check if enough quantity in shop
        for(let i = 0; i < items.length; i++) {
            //items[i] is the _id of the items
            const item = await Models.ShopItem.findOne({ itemId: items[i] });

            if (!item) {
                return res.status(StatusCode.ClientErrorNotFound).send(ShopItemNotFoundError);
            }

            const q = quantity?.[i] as number | undefined;
            if(q == undefined || item.quantity < q) {
                return res.status(StatusCode.ClientErrorBadRequest).send(ShopInsufficientFundsError);
            }
        }

        //check if user has enough coins
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

            if (profile.points < currPrice) {
                return res.status(StatusCode.ClientErrorBadRequest).send(ShopInsufficientFundsError);
            }
        }

        //have availability of all item and user has enough coins so can generate qr code with order number
        const qrCodeUrl = `hackillinois://userId?userId=${userId}`;

        return res.status(StatusCode.SuccessOK).send({ qrInfo: qrCodeUrl });
    },
);


function getRand(index: number): string {
    const hash = crypto.createHash("sha256").update(`${Config.JWT_SECRET}|${index}`).digest("hex");
    return hash;
}

export default shopRouter;