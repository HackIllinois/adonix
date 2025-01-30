import {
    ShopInsufficientFundsError,
    ShopInsufficientFundsErrorSchema,
    ShopInsufficientQuantityErrorSchema,
    ShopItem,
    ShopItemIdSchema,
    ShopItemNotFoundError,
    ShopItemNotFoundErrorSchema,
    ShopItemSchema,
    ShopItemsSchema,
    ShopItemUpdateRequestSchema,
    ShopItemGenerateOrderSchema,
    ShopItemFulfillOrderSchema,
    SuccessSchema,
    ShopOrder,
    OrderQRCodesSchema,
    ShopInsufficientQuantityError,
    ShopOrderNotFoundError,
    ShopOrderNotFoundErrorSchema,
} from "./shop-schemas";
import { Router } from "express";
import { StatusCode } from "status-code-enum";
import Models from "../../common/models";
import { Role } from "../auth/auth-schemas";
import specification, { Tag } from "../../middleware/specification";
import { z } from "zod";
import { SuccessResponseSchema } from "../../common/schemas";
import { updatePoints } from "../profile/profile-lib";
import { getAuthenticatedUser } from "../../common/auth";
import { UserNotFoundError } from "../user/user-schemas";

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
        return res.status(StatusCode.SuccessOK).send(shopItems);
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
                description: "User's order doesn't exist in DB",
                schema: ShopOrderNotFoundErrorSchema,
            },
            [StatusCode.ClientErrorBadRequest]: {
                description: "Not enough quantity in shop",
                schema: ShopInsufficientQuantityErrorSchema,
            },
            [StatusCode.ClientErrorPaymentRequired]: {
                description: "Not enough points to purchase",
                schema: ShopInsufficientFundsErrorSchema,
            },
        },
    }),
    async (req, res) => {
        try {
            const { userId } = req.body;

            // Retrieve the user's order
            const order = await Models.ShopOrder.findOne({ userId });
            if (!order) {
                return res.status(StatusCode.ClientErrorNotFound).send(ShopOrderNotFoundError);
            }

            // Retrieve the user's profile
            const profile = await Models.AttendeeProfile.findOne({ userId: order.userId });
            if (!profile) {
                return res.status(StatusCode.ClientErrorNotFound).send(UserNotFoundError);
            }

            let totalPointsRequired = 0;

            // Loop through items and check availability and price
            for (let i = 0; i < order.items.length; i++) {
                const item = await Models.ShopItem.findOne({ itemId: order.items[i] });
                if (!item) {
                    return res.status(StatusCode.ClientErrorNotFound).send(ShopItemNotFoundError);
                }

                const quantity = order.quantity?.[i] ?? 0; // Default to 0 if undefined
                totalPointsRequired += quantity * item.price;

                // Check if requested quantity is available
                if (quantity > item.quantity) {
                    return res.status(StatusCode.ClientErrorNotFound).send(ShopInsufficientQuantityError);
                }
            }

            // Check if the user has enough points for the order
            const userProfile = await Models.AttendeeProfile.findOne({ userId: order.userId });
            if (!userProfile || userProfile.points < totalPointsRequired) {
                return res.status(StatusCode.ClientErrorPaymentRequired).send(ShopInsufficientFundsError);
            }

            // Update the inventory and user points
            for (let i = 0; i < order.items.length; i++) {
                const item = await Models.ShopItem.findOne({ itemId: order.items[i] });
                const quantity = order.quantity?.[i] ?? 0;
                if (!item) {
                    return res.status(StatusCode.ClientErrorNotFound).send(ShopItemNotFoundError);
                }

                // Deduct item quantity from stock
                await Models.ShopItem.updateOne({ itemId: order.items[i] }, { $inc: { quantity: -quantity } });

                // Deduct points from user profile
                await updatePoints(order.userId, -(quantity * item.price));
            }

            // Clear the user's order from the cart
            const result = await Models.ShopOrder.deleteOne({ userId });
            if (result.deletedCount === 0) {
                return res.status(StatusCode.ClientErrorNotFound).json({ message: "Not able to clear cart" });
            }

            return res.status(StatusCode.SuccessOK).json({ message: "Success" });
        } catch (error) {
            console.error("Error processing order:", error);
            return res.status(StatusCode.ServerErrorInternal).json({ message: "Internal server error" });
        }
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
                schema: ShopInsufficientQuantityErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { itemId } = req.params;
        const { id: userId } = getAuthenticatedUser(req);

        let userOrder = await Models.ShopOrder.findOne({ userId: userId });
        //user doesn't have a order yet
        if (!userOrder) {
            const shopOrder: ShopOrder = {
                items: [],
                quantity: [],
                userId: userId,
            };

            await Models.ShopOrder.create(shopOrder);
            userOrder = await Models.ShopOrder.findOne({ userId: userId });
        }

        if (!userOrder) {
            throw Error("Creating cart for user failed.");
        }

        //check if enough quantity in shop
        const item = await Models.ShopItem.findOne({ itemId: itemId });
        if (!item) {
            return res.status(StatusCode.ClientErrorNotFound).send(ShopItemNotFoundError);
        }

        if (item.quantity <= 0) {
            return res.status(StatusCode.ClientErrorBadRequest).send(ShopInsufficientQuantityError);
        }

        //check if user has enough coins
        const profile = await Models.AttendeeProfile.findOne({ userId: userId });
        if (!profile) {
            throw Error("Could not find attendee profile");
        }

        if (profile.points < item.price) {
            return res.status(StatusCode.ClientErrorPaymentRequired).send(ShopInsufficientFundsError);
        }

        //add item to order or increase quantity
        const items = userOrder.items;
        let found = false;
        for (let i = 0; i < items.length; i++) {
            if ((items[i] = itemId)) {
                found = true;

                const updatedShopOrder = await Models.ShopOrder.updateOne(
                    { userId: userId },
                    {
                        $inc: { [`quantity.${i}`]: 1 },
                    },
                );
                if (!updatedShopOrder) {
                    return res.status(StatusCode.ClientErrorNotFound).send(ShopItemNotFoundError);
                }
            }
        }
        if (!found) {
            const updatedShopOrder = await Models.ShopOrder.updateOne(
                { userId: userId },
                {
                    $push: {
                        items: itemId,
                        quantity: 1,
                    },
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
                description: "Order doesn't exist",
                schema: ShopOrderNotFoundErrorSchema,
            },
            [StatusCode.ClientErrorPaymentRequired]: {
                description: "Not enough quantity in shop",
                schema: ShopInsufficientQuantityErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);

        //get their order from order db
        let userOrder = await Models.ShopOrder.findOne({ userId: userId });
        if (!userOrder) {
            const shopOrder: ShopOrder = {
                items: [],
                quantity: [],
                userId: userId,
            };

            await Models.ShopOrder.create(shopOrder);
            userOrder = await Models.ShopOrder.findOne({ userId: userId });
        }

        if (!userOrder) {
            return res.status(StatusCode.ClientErrorNotFound).send(ShopOrderNotFoundError);
        }

        const items = userOrder.items;
        const quantity = userOrder.quantity;

        return res.status(StatusCode.SuccessOK).send({ items: items, quantity: quantity });
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
        if (!userOrder) {
            return res.status(StatusCode.ClientErrorNotFound).send(ShopItemNotFoundError);
        }
        const items = userOrder.items;
        const quantity = userOrder.quantity;
        //check if enough quantity in shop
        for (let i = 0; i < items.length; i++) {
            //items[i] is the _id of the items
            const item = await Models.ShopItem.findOne({ itemId: items[i] });

            if (!item) {
                return res.status(StatusCode.ClientErrorNotFound).send(ShopItemNotFoundError);
            }

            const q = quantity?.[i] as number | undefined;
            if (q == undefined || item.quantity < q) {
                return res.status(StatusCode.ClientErrorBadRequest).send(ShopInsufficientQuantityError);
            }
        }

        //check if user has enough coins
        let currPrice = 0;
        for (let i = 0; i < items.length; i++) {
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
                return res.status(StatusCode.ClientErrorPaymentRequired).send(ShopInsufficientFundsError);
            }
        }

        //have availability of all item and user has enough coins so can generate qr code with order number
        const qrCodeUrl = `hackillinois://userId?userId=${userId}`;

        return res.status(StatusCode.SuccessOK).send({ qrInfo: qrCodeUrl });
    },
);

export default shopRouter;
