import crypto from "crypto";
import Config from "../../config.js";
import { Request, Response, Router } from "express";
import { NextFunction } from "express-serve-static-core";
import { weakJwtVerification, strongJwtVerification } from "../../middleware/verify-jwt.js";
import { hasAdminPerms } from "../auth/auth-lib.js";
import { JwtPayload } from "../auth/auth-models.js";
import { DeleteResult } from "mongodb";
import { StatusCode } from "status-code-enum";
import { RouterError } from "../../middleware/error-handler.js";
import { ItemFormat, QuantityFormat, ShopItemFormat } from "./shop-formats.js";
import Models from "../../database/models.js";

/**
 * @api {get} /shop GET /shop
 * @apiGroup Shop
 * @apiDescription Get item details for all items.
 *
 * @apiSuccess (200: Success) {Json} items The items details.
 * @apiSuccessExample Example Success Response
 * HTTP/1.1 200 OK
 * {
 *   [{
 *      "itemId": "item01",
 *      "name": "HackIllinois Branded Hoodie",
 *      "price": 15,
 *      "isRaffle": true,
 *      "quantity": 1
 *   }, {
 *      "itemId": "item02",
 *      "name": "Snack Pack!",
 *      "price": 20,
 *      "isRaffle": false,
 *      "quantity": 25
 *   }]
 * }
 *
 * @apiUse weakVerifyErrors
 * */

const shopRouter: Router = Router();
shopRouter.get("/", weakJwtVerification, async (_: Request, res: Response, next: NextFunction) => {
    try {
        const shopItems: ShopItemFormat[] = await Models.ShopItem.find();
        const shopQuantities: QuantityFormat[] = await Models.ShopQuantity.find();

        const itemsMap = new Map<string, ShopItemFormat>();
        shopItems.forEach((item) => {
            return itemsMap.set(item.itemId, item);
        });

        const itemsWithQuantity: ItemFormat[] = Array.from(itemsMap.values()).map((item) => {
            const quantity = shopQuantities.find((q) => {
                return q.itemId === item.itemId;
            });
            const itemQuantity = quantity ? quantity.quantity : 0;

            return {
                itemId: item.itemId,
                name: item.name || "",
                price: item.price || 0,
                isRaffle: item.isRaffle || false,
                quantity: itemQuantity,
            };
        });

        return res.status(StatusCode.SuccessOK).send(itemsWithQuantity);
    } catch (error) {
        console.error(error);
        return next(new RouterError(StatusCode.ServerErrorInternal, "InternalServerError"));
    }
});

/**
 * @api {post} /shop/item post /shop/item
 * @apiGroup Shop
 * @apiDescription Insert a new item into the shop.
 * 
 * @apiHeader {String} Authorization User's JWT Token with admin permissions.
 * 
 * @apiBody {Json} item The item details to be created.
 * @apiParamExample {Json} Request Body Example for an Item:
 * {
 *      "name": "HackIllinois Branded Hoodie",
 *      "price": 15,
 *      "isRaffle": true,
 *      "quantity": 1
 * }
 *
 * @apiSuccess (200: Success) {Json} items The items details.
 * @apiSuccessExample Example Success Response
 * HTTP/1.1 200 OK
 * {
 *      "itemId": "item01",
 *      "name": "HackIllinois Branded Hoodie",
 *      "price": 15,
 *      "isRaffle": true,
 *      "quantity": 1
 * }
 *
 * @apiUse strongVerifyErrors
 * @apiError (400: Bad Request) {String} ExtraIdProvided Invalid item parameters provided.
 * @apiError (400: Bad Request) {String} ItemAlreadyExists Item already exists in shop.
 * @apiError (403: Forbidden) {String} InvalidPermission User does not have admin permissions.
 * @apiError (500: Internal Server Error) {String} InternalError An error occurred on the server.
 * */
shopRouter.post("/item", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    // Check if the token has admin permissions
    if (!hasAdminPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "InvalidPermission"));
    }

    if (req.body.itemId) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "ExtraIdProvided", { extraItemId: req.body.itemId }));
    }

    const itemId = "item" + parseInt(crypto.randomBytes(Config.SHOP_BYTES_GEN).toString("hex"),16);

    const metaItem: ItemFormat = req.body as ItemFormat;
    metaItem.itemId = itemId;

    const shopItem: ShopItemFormat = {
        itemId: itemId,
        name: req.body.name,
        price: req.body.price,
        isRaffle: req.body.isRaffle,
    };

    const itemQuantity: QuantityFormat = {
        itemId: itemId,
        quantity: req.body.quantity
    };

    // Ensure that user doesn't already exist before creating
    const item1: ShopItemFormat | null = await Models.ShopItem.findOne({ itemId: shopItem.itemId });
    const item2: QuantityFormat | null = await Models.ShopQuantity.findOne({ itemId: itemQuantity.itemId });
    if (item1 || item2) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "ItemAlreadyExists"));
    }

    try {
        await Models.ShopItem.create(shopItem);
        await Models.ShopQuantity.create(itemQuantity);
        return res.status(StatusCode.SuccessOK).send(metaItem);
    } catch (error) {
        console.error(error);
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "InvalidParams"));
    }
});

/**
 * @api {delete} /shop/item/:ITEMID DELETE /shop/item/:ITEMID
 * @apiGroup Shop
 * @apiDescription Delete the a specific item in the point shop based itemId.
 * 
 * @apiHeader {String} Authorization User's JWT Token with admin permissions.
 *
 * @apiSuccess (200: Success) {Json} success Indicates successful deletion of the user's profile.
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 * {
 *    "success": true
 * }
 * 
 * @apiUse strongVerifyErrors
 * @apiError (403: NotFound) {String} ItemNotFound Item not found in the shop.
 * @apiError (403: Forbidden) {String} InvalidPermission User does not have admin permissions.
 * @apiError (500: Internal Server Error) {String} InternalError An error occurred on the server.
 */
shopRouter.delete("/item/:ITEMID", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    // Check if the token has admin permissions
    if (!hasAdminPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "InvalidPermission"));
    }

    const targetItem: string | undefined = req.params.ITEMID as string;

    const shopItemDeleteResponse: DeleteResult = await Models.ShopItem.deleteOne({ itemId: targetItem });
    const shopQuantityDeleteResponse: DeleteResult = await Models.ShopQuantity.deleteOne({ itemId: targetItem });

    if (shopItemDeleteResponse.deletedCount == 0 || shopQuantityDeleteResponse.deletedCount == 0) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "ItemNotFound"));
    }
    return res.status(StatusCode.SuccessOK).send({ success: true });
});

export default shopRouter;
