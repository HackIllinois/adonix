import {
    ShopInsufficientFundsError,
    ShopInsufficientFundsErrorSchema,
    ShopInsufficientQuantityErrorSchema,
    ShopItem,
    ShopItemIdSchema,
    ShopItemNotFoundError,
    ShopItemNotFoundErrorSchema,
    ShopItemsSchema,
    ShopItemFulfillOrderSchema,
    ShopOrder,
    OrderQRCodesSchema,
    ShopInsufficientQuantityError,
    ShopInternalErrorSchema,
    ShopInternalError,
    ShopOrderInfoSchema,
} from "./shop-schemas";
import { Router } from "express";
import { StatusCode } from "status-code-enum";
import Models from "../../common/models";
import { Role } from "../auth/auth-schemas";
import specification, { Tag } from "../../middleware/specification";
import { z } from "zod";
import { updatePoints } from "../profile/profile-lib";
import { getAuthenticatedUser } from "../../common/auth";
import Config from "../../common/config";

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
                schema: ShopOrderInfoSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Shop Item DNE",
                schema: ShopItemNotFoundErrorSchema,
            },
            [StatusCode.ClientErrorBadRequest]: {
                description: "Not enough quantity in shop",
                schema: ShopInsufficientQuantityErrorSchema,
            },
            [StatusCode.ClientErrorPaymentRequired]: {
                description: "Not enough points to purchase",
                schema: ShopInsufficientFundsErrorSchema,
            },
            [StatusCode.ServerErrorInternal]: {
                description: "Errors that should never happen",
                schema: ShopInternalErrorSchema,
            },
        },
    }),
    async (req, res) => {
        try {
            const { userId } = req.body;

            // Retrieve the user's order
            const order = await Models.ShopOrder.findOne({ userId });
            if (!order) {
                return res.status(StatusCode.ServerErrorInternal).send(ShopInternalError);
            }

            // Retrieve the user's profile
            const profile = await Models.AttendeeProfile.findOne({ userId: order.userId });
            if (!profile) {
                return res.status(StatusCode.ServerErrorInternal).send(ShopInternalError);
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
                    return res.status(StatusCode.ClientErrorBadRequest).send(ShopInsufficientQuantityError);
                }
            }

            // Check if the user has enough points for the order
            if (!profile || profile.points < totalPointsRequired) {
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
            await Models.ShopOrder.deleteOne({ userId });
            return res.status(StatusCode.SuccessOK).json(order);
        } catch (error) {
            console.error("Error processing order:", error);
            return res.status(StatusCode.ServerErrorInternal).json(ShopInternalError);
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
                description: "The successfully updated order",
                schema: ShopOrderInfoSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Shop Item DNE",
                schema: ShopItemNotFoundErrorSchema,
            },
            [StatusCode.ClientErrorBadRequest]: {
                description: "Not enough quantity in shop",
                schema: ShopInsufficientQuantityErrorSchema,
            },
            [StatusCode.ClientErrorPaymentRequired]: {
                description: "Not enough points to purchase",
                schema: ShopInsufficientFundsErrorSchema,
            },
            [StatusCode.ServerErrorInternal]: {
                description: "Errors that should never happen",
                schema: ShopInternalErrorSchema,
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

            userOrder = await Models.ShopOrder.create(shopOrder);
        }

        // This should never get hit, just checking here so typescript doesn't get mad
        if (!userOrder) {
            return res.status(StatusCode.ServerErrorInternal).send(ShopInternalError);
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
        // This should never get hit.
        if (!profile) {
            return res.status(StatusCode.ServerErrorInternal).json(ShopInternalError);
        }

        if (profile.points < item.price) {
            return res.status(StatusCode.ClientErrorPaymentRequired).send(ShopInsufficientFundsError);
        }

        //add item to order or increase quantity
        const items = userOrder.items;
        let found = false;
        for (let i = 0; i < items.length; i++) {
            if (items[i] === itemId) {
                found = true;

                const updatedOrder = await Models.ShopOrder.updateOne(
                    { userId: userId },
                    {
                        $inc: { [`quantity.${i}`]: 1 },
                    },
                );
                if (!updatedOrder) {
                    return res.status(StatusCode.ServerErrorInternal).send(ShopInternalError);
                }
            }
        }
        if (!found) {
            const updatedOrder = await Models.ShopOrder.updateOne(
                { userId: userId },
                {
                    $push: {
                        items: itemId,
                        quantity: 1,
                    },
                },
            );

            if (!updatedOrder) {
                return res.status(StatusCode.ServerErrorInternal).send(ShopInternalError);
            }
        }

        const updatedOrder = await Models.ShopOrder.findOne({ userId });
        if (updatedOrder) {
            return res.status(StatusCode.SuccessOK).json(updatedOrder);
        }
        return res.status(StatusCode.ServerErrorInternal).send(ShopInternalError);
    },
);

shopRouter.delete(
    "/cart/:itemId",
    specification({
        method: "delete",
        path: "/shop/cart/{itemId}/",
        tag: Tag.SHOP,
        role: Role.USER,
        summary: "Removes a single instance of an item from the user's cart",
        parameters: z.object({
            itemId: ShopItemIdSchema,
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The successfully updated order",
                schema: ShopOrderInfoSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Shop Item DNE",
                schema: ShopItemNotFoundErrorSchema,
            },
            [StatusCode.ServerErrorInternal]: {
                description: "Errors that should never happen",
                schema: ShopInternalErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { itemId } = req.params;
        const { id: userId } = getAuthenticatedUser(req);

        const userOrder = await Models.ShopOrder.findOne({ userId: userId });

        // Check if user has an order
        if (!userOrder) {
            return res.status(StatusCode.ServerErrorInternal).send(ShopInternalError); // No order found
        }

        // Find the index of the item in the user's cart
        const itemIndex = userOrder.items.indexOf(itemId);
        if (itemIndex === Config.NOT_FOUND) {
            return res.status(StatusCode.ClientErrorNotFound).send(ShopItemNotFoundError); // Item not in cart
        }

        // Update the order, decrement the quantity of the item by 1
        const updatedShopOrder = await Models.ShopOrder.updateOne(
            { userId: userId },
            {
                $inc: { [`quantity.${itemIndex}`]: -1 },
            },
        );

        // If update fails
        if (!updatedShopOrder) {
            return res.status(StatusCode.ServerErrorInternal).send(ShopInternalError); // Internal error
        }

        // If the quantity of the item becomes 0, remove the item from the cart
        if ((userOrder.quantity?.[itemIndex] ?? 0) - 1 === 0) {
            await Models.ShopOrder.updateOne(
                { userId: userId },
                {
                    $pull: {
                        items: itemId,
                        quantity: 0, // Remove the corresponding quantity as well
                    },
                },
            );
        }

        const updatedOrder = await Models.ShopOrder.findOne({ userId });
        if (updatedOrder) {
            return res.status(StatusCode.SuccessOK).json(updatedOrder);
        }
        return res.status(StatusCode.ServerErrorInternal).send(ShopInternalError);
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
                schema: ShopOrderInfoSchema,
            },
            [StatusCode.ServerErrorInternal]: {
                description: "Errors that should never happen",
                schema: ShopInternalErrorSchema,
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

            userOrder = await Models.ShopOrder.create(shopOrder);
        }

        if (!userOrder) {
            return res.status(StatusCode.ServerErrorInternal).send(ShopInternalError);
        }

        return res.status(StatusCode.SuccessOK).send(userOrder);
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
                description: "QR code",
                schema: OrderQRCodesSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Shop Item DNE",
                schema: ShopItemNotFoundErrorSchema,
            },
            [StatusCode.ClientErrorBadRequest]: {
                description: "Not enough quantity in shop",
                schema: ShopInsufficientFundsErrorSchema,
            },
            [StatusCode.ClientErrorPaymentRequired]: {
                description: "User doesn't have enough points to purchase",
                schema: ShopInsufficientFundsErrorSchema,
            },
            [StatusCode.ServerErrorInternal]: {
                description: "Errors that should never happen",
                schema: ShopInternalErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);

        // Fetch user order
        const userOrder = await Models.ShopOrder.findOne({ userId });
        if (!userOrder) {
            return res.status(StatusCode.ServerErrorInternal).send(ShopInternalError);
        }

        const { items, quantity } = userOrder;

        // Fetch all shop items in one query
        const shopItems = await Models.ShopItem.find({ itemId: { $in: items } });
        const itemMap = new Map(shopItems.map((item) => [item.itemId, item]));

        // Validate item availability
        for (let i = 0; i < items.length; i++) {
            const item = itemMap.get(items[i] ?? "");
            if (!item) {
                return res.status(StatusCode.ClientErrorNotFound).send(ShopItemNotFoundError);
            }
            const currentQuantity = quantity[i] ?? 0;
            if (currentQuantity > item.quantity) {
                return res.status(StatusCode.ClientErrorBadRequest).send(ShopInsufficientFundsError);
            }
        }

        // Fetch user profile once
        const profile = await Models.AttendeeProfile.findOne({ userId });
        if (!profile) {
            return res.status(StatusCode.ServerErrorInternal).send(ShopInternalError);
        }

        // Compute total cost
        const totalPrice = items.reduce((sum, itemId, i) => {
            const itemPrice = itemMap.get(itemId)?.price ?? 0; // Default to 0 if item price is not found
            const itemQuantity = quantity[i] ?? 0; // Default to 0 if quantity is undefined
            return sum + itemPrice * itemQuantity;
        }, 0);

        // Check if user has enough points
        if (profile.points < totalPrice) {
            return res.status(StatusCode.ClientErrorPaymentRequired).send(ShopInsufficientFundsError);
        }

        // Generate QR code
        const qrCodeUrl = `hackillinois://shop?userId=${userId}`;
        return res.status(StatusCode.SuccessOK).send({ qrInfo: qrCodeUrl });
    },
);

export default shopRouter;
