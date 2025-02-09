import {
    ShopInsufficientFundsError,
    ShopInsufficientFundsErrorSchema,
    ShopInsufficientQuantityErrorSchema,
    ShopItem,
    ShopItemIdSchema,
    ShopItemNotFoundError,
    ShopItemNotFoundErrorSchema,
    ShopItemsSchema,
    OrderRequestSchema,
    ShopOrder,
    ShopInsufficientQuantityError,
    ShopOrderInfoSchema,
    ShopItemSchema,
    ShopItemUpdateRequestSchema,
    ShopItemAlreadyExistsError,
    ShopItemCreateRequestSchema,
    ShopItemAlreadyExistsErrorSchema,
    OrderRedeemSchema,
} from "./shop-schemas";
import { Router } from "express";
import { StatusCode } from "status-code-enum";
import Models from "../../common/models";
import { Role } from "../auth/auth-schemas";
import specification, { Tag } from "../../middleware/specification";
import { z } from "zod";
import { updatePoints } from "../profile/profile-lib";
import { getAuthenticatedUser } from "../../common/auth";
import { decryptQRCode, generateQRCode } from "../user/user-lib";
import { SuccessResponseSchema } from "../../common/schemas";
import { randomUUID } from "crypto";

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
        const itemId = randomUUID();

        const shopItem: ShopItem = {
            ...details,
            itemId: itemId,
        };

        // Ensure that item doesn't already exist before creating
        const itemExists = (await Models.ShopItem.findOne({ name: details.name })) ?? false;
        if (itemExists) {
            return res.status(StatusCode.ClientErrorConflict).send(ShopItemAlreadyExistsError);
        }

        const newItem = await Models.ShopItem.create(shopItem);

        return res.status(StatusCode.SuccessOK).send(newItem);
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

        return res.status(StatusCode.SuccessOK).send(updatedItem);
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
        body: OrderRequestSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The successfully purchased order",
                schema: ShopOrderInfoSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Shop Item doesn't exist",
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
        },
    }),
    async (req, res) => {
        const { QRCode } = req.body;
        const userId = decryptQRCode(QRCode);

        // Retrieve the user's order
        const order = await Models.ShopOrder.findOne({ userId });
        if (!order) {
            throw new Error("nonexistent order");
        }

        // Retrieve the user's profile
        const profile = await Models.AttendeeProfile.findOne({ userId: order.userId });
        if (!profile) {
            throw new Error("nonexistent profile");
        }

        // Gather all item IDs from the order
        const itemIds = Array.from(order.items.keys());

        // Fetch all shop items with one query
        const items = await Models.ShopItem.find({ itemId: { $in: itemIds } });

        // Create a map of itemId to item document for easy lookup
        const itemsMap = new Map(items.map((item) => [item.itemId, item]));

        let totalPointsRequired = 0;

        // Loop through each order item to check availability and calculate total points required
        for (const [itemId, quantity] of order.items.entries()) {
            const item = itemsMap.get(itemId);
            if (!item) {
                return res.status(StatusCode.ClientErrorNotFound).send(ShopItemNotFoundError);
            }

            totalPointsRequired += quantity * item.price;

            // Check if the requested quantity is available
            if (quantity > item.quantity) {
                return res.status(StatusCode.ClientErrorBadRequest).send(ShopInsufficientQuantityError);
            }
        }

        // Check if the user has enough points for the order
        if (profile.points < totalPointsRequired) {
            return res.status(StatusCode.ClientErrorPaymentRequired).send(ShopInsufficientFundsError);
        }

        let totalPrice = 0;
        // Update the inventory and deduct points
        for (const [itemId, quantity] of order.items.entries()) {
            const item = itemsMap.get(itemId);
            if (!item) {
                return res.status(StatusCode.ClientErrorNotFound).send(ShopItemNotFoundError);
            }

            // Deduct the item's quantity from stock
            await Models.ShopItem.updateOne({ itemId }, { $inc: { quantity: -quantity } });

            // Deduct points from the user's profile
            totalPrice = totalPrice + quantity * item.price;
        }
        await updatePoints(order.userId, -totalPrice);

        // Clear the user's order from the cart
        await Models.ShopOrder.deleteOne({ userId });

        // Convert order.items (a Map) to an array of tuples since Zod doesn't support maps
        const zodOrder = {
            userId: order.userId,
            items: Object.fromEntries(order.items.entries()),
        };

        return res.status(StatusCode.SuccessOK).json(zodOrder);
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
                description: "Shop Item doesn't exist",
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
        },
    }),
    async (req, res) => {
        const { itemId } = req.params;
        const { id: userId } = getAuthenticatedUser(req);

        let userOrder = await Models.ShopOrder.findOne({ userId: userId });
        // user doesn't have an order yet
        if (!userOrder) {
            // Create a new order with an empty list of items (which becomes an empty Map)
            userOrder = await Models.ShopOrder.create(new ShopOrder([], userId));
        }

        // This should never get hit, just checking here so typescript doesn't get mad
        if (!userOrder) {
            throw new Error("nonexistent order");
        }

        // check if enough quantity in shop
        const item = await Models.ShopItem.findOne({ itemId: itemId });
        if (!item) {
            return res.status(StatusCode.ClientErrorNotFound).send(ShopItemNotFoundError);
        }

        if (item.quantity <= 0) {
            return res.status(StatusCode.ClientErrorBadRequest).send(ShopInsufficientQuantityError);
        }

        // check if user has enough coins
        const profile = await Models.AttendeeProfile.findOne({ userId: userId });
        // This should never get hit.
        if (!profile) {
            throw new Error("nonexistent profile");
        }

        if (profile.points < item.price) {
            return res.status(StatusCode.ClientErrorPaymentRequired).send(ShopInsufficientFundsError);
        }

        // add item to order or increase quantity
        // Since userOrder.items is now a Map, check if the item already exists.
        if (userOrder.items.has(itemId)) {
            const updatedOrder = await Models.ShopOrder.updateOne(
                { userId: userId },
                {
                    $inc: { [`items.${itemId}`]: 1 },
                },
            );
            if (!updatedOrder) {
                throw new Error("internal db query error");
            }
        } else {
            const updatedOrder = await Models.ShopOrder.updateOne(
                { userId: userId },
                {
                    $set: { [`items.${itemId}`]: 1 },
                },
            );
            if (!updatedOrder) {
                throw new Error("internal db query error");
            }
        }

        const updatedOrder = await Models.ShopOrder.findOne({ userId });
        if (!updatedOrder) {
            throw new Error("internal db query error");
        }
        // Convert order to array of tuples cuz zod doesn't fw maps
        const zodOrder = {
            userId: updatedOrder.userId,
            items: Object.fromEntries(updatedOrder.items.entries()),
        };
        return res.status(StatusCode.SuccessOK).json(zodOrder);
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
                description: "Shop Item doesn't exist",
                schema: ShopItemNotFoundErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { itemId } = req.params;
        const { id: userId } = getAuthenticatedUser(req);

        const userOrder = await Models.ShopOrder.findOne({ userId: userId });

        // Check if user has an order
        if (!userOrder) {
            return res.status(StatusCode.ClientErrorNotFound).send(ShopItemNotFoundError); // No order found
        }

        // Check if the item exists in the user's cart (map)
        if (!userOrder.items.has(itemId)) {
            return res.status(StatusCode.ClientErrorNotFound).send(ShopItemNotFoundError); // Item not in cart
        }

        // Decrement the quantity of the item by 1
        const updatedShopOrder = await Models.ShopOrder.updateOne(
            { userId: userId },
            {
                $inc: { [`items.${itemId}`]: -1 },
            },
        );

        // If update fails
        if (!updatedShopOrder) {
            throw new Error("internal db query error");
        }

        // If the quantity of the item becomes 0, remove the item from the cart
        if ((userOrder.items.get(itemId) ?? 0) - 1 === 0) {
            await Models.ShopOrder.updateOne(
                { userId: userId },
                {
                    $unset: { [`items.${itemId}`]: "" },
                },
            );
        }

        const updatedOrder = await Models.ShopOrder.findOne({ userId });
        if (!updatedOrder) {
            throw new Error("internal db query error");
        }
        // Convert order to array of tuples cuz zod doesn't fw maps
        const zodOrder = {
            userId: updatedOrder.userId,
            items: Object.fromEntries(updatedOrder.items.entries()),
        };
        return res.status(StatusCode.SuccessOK).json(zodOrder);
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
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);

        // Get their order from order db
        let userOrder = await Models.ShopOrder.findOne({ userId: userId });
        if (!userOrder) {
            userOrder = await Models.ShopOrder.create(new ShopOrder([], userId));
        }

        if (!userOrder) {
            throw new Error("nonexistent order");
        }

        // Convert order to array of tuples cuz zod doesn't fw maps
        const zodOrder = {
            userId: userOrder.userId,
            items: Object.fromEntries(userOrder.items.entries()),
        };
        return res.status(StatusCode.SuccessOK).send(zodOrder);
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
                schema: OrderRedeemSchema,
            },
            [StatusCode.ClientErrorNotFound]: {
                description: "Shop Item doesn't exist",
                schema: ShopItemNotFoundErrorSchema,
            },
            [StatusCode.ClientErrorBadRequest]: {
                description: "Not enough quantity in shop",
                schema: ShopInsufficientQuantityErrorSchema,
            },
            [StatusCode.ClientErrorPaymentRequired]: {
                description: "User doesn't have enough points to purchase",
                schema: ShopInsufficientFundsErrorSchema,
            },
        },
    }),
    async (req, res) => {
        const { id: userId } = getAuthenticatedUser(req);

        // Fetch user order
        const userOrder = await Models.ShopOrder.findOne({ userId });
        if (!userOrder) {
            throw new Error("nonexistent order");
        }

        // Get all item IDs from the order's map
        const itemIds = Array.from(userOrder.items.keys());

        // Fetch all shop items in one query
        const shopItems = await Models.ShopItem.find({ itemId: { $in: itemIds } });
        const itemMap = new Map(shopItems.map((item) => [item.itemId, item]));

        // Validate item availability
        for (const [itemId, currentQuantity] of userOrder.items.entries()) {
            const item = itemMap.get(itemId);
            if (!item) {
                return res.status(StatusCode.ClientErrorNotFound).send(ShopItemNotFoundError);
            }
            if (currentQuantity > item.quantity) {
                return res.status(StatusCode.ClientErrorBadRequest).send(ShopInsufficientQuantityError);
            }
        }

        // Fetch user profile once
        const profile = await Models.AttendeeProfile.findOne({ userId });
        if (!profile) {
            throw new Error("nonexistent profile");
        }

        // Compute total cost
        let totalPrice = 0;
        for (const [itemId, currentQuantity] of userOrder.items.entries()) {
            const itemPrice = itemMap.get(itemId)?.price ?? 0;
            totalPrice += itemPrice * currentQuantity;
        }

        // Check if user has enough points
        if (profile.points < totalPrice) {
            return res.status(StatusCode.ClientErrorPaymentRequired).send(ShopInsufficientFundsError);
        }

        // Generate QR code
        const qrCodeUrl = generateQRCode(userId);
        return res.status(StatusCode.SuccessOK).send({ QRCode: qrCodeUrl });
    },
);

export default shopRouter;
