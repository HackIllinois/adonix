import { Request, Response, Router } from "express";
import { NextFunction } from "express-serve-static-core";
import { strongJwtVerification, weakJwtVerification } from "../../middleware/verify-jwt.js";
import { hasStaffPerms } from "../auth/auth-lib.js";
import { StatusCode } from "status-code-enum";
import { JwtPayload } from "../auth/auth-models.js";
import { RouterError } from "../../middleware/error-handler.js";
import { ItemFormat, QuantityFormat, ShopItemFormat } from "./shop-formats.js";
import crypto from "crypto";
import Config from "../../config.js";
import { ShopItem, ShopQuantity } from "../../database/shop-db.js";
import Models from "../../database/models.js";

const shopRouter: Router = Router();

/**
 * @api {get} /shop/ GET /shop/
 * @apiGroup Shop
 * @apiDescription Get item details for all items.
 *
 * @apiSuccess (200: Success) {Json} items The items details.
 * @apiSuccessExample Example Success Response
 * HTTP/1.1 200 OK
 * {
 *   [{
 *      "name": "hoodie",
 *      "price": 15,
 *      "isRaffle": true
 *      "quantity": 20
 *   }, {
 *      "name": "shoe",
 *      "price": 20,
 *      "isRaffle": false
 *      "quantity": 1
 *   }]
 * }
 *
 * @apiUse weakJwtVerification
 * */
shopRouter.get("/", weakJwtVerification, async (_: Request, res: Response, next: NextFunction) => {
    try {
        const shopItems: ShopItemFormat[] = await Models.ShopItem.find();
        const shopQuantities: QuantityFormat[] = await Models.ShopQuantity.find();

        const itemsMap = shopItems.reduce((acc: Record<string, ShopItemFormat>, item: ShopItemFormat) => {
            acc[item.itemId] = item;
            return acc;
        }, {});

        const quantitiesMap = shopQuantities.reduce((acc: Record<string, QuantityFormat>, quantity: QuantityFormat) => {
            acc[quantity.itemId] = quantity;
            return acc;
        }, {});

        const itemIds = new Set([...Object.keys(itemsMap), ...Object.keys(quantitiesMap)]);

        const itemsWithQuantity: ItemFormat[] = Array.from(itemIds).map((itemId: string) => {
            const item: ShopItemFormat = itemsMap[itemId] || {
                itemId,
                name: "",
                price: 0,
                isRaffle: false,
            };
            const quantity: QuantityFormat = quantitiesMap[itemId] || { itemId, quantity: 0 };

            return {
                itemId,
                name: item.name || "",
                price: item.price || 0,
                isRaffle: item.isRaffle || false,
                quantity: quantity.quantity || 0,
            };
        });

        return res.status(StatusCode.SuccessOK).send(itemsWithQuantity);
    } catch (error) {
        console.error(error);
        return next(new RouterError(StatusCode.ServerErrorInternal, "InternalServerError"));
    }
});

/**
 * @api {post} /shop/ POST /shop/
 * @apiGroup Shop
 * @apiDescription Create a new item.
 *
 * @apiHeader {String} Authorization User's JWT Token with admin permissions.
 *
 * @apiBody {Json} sitem The item details to be created.
 * @apiParamExample {Json} Request Body Example for Shop Item:
 * {
 *   "name": "hoodie",
 *   "price": 15,
 *   "isRaffle": true
 *   "quantity": 20
 * }
 *
 * @apiSuccess (201: Created) {Json} item The created item details.
 * @apiSuccessExample Example Success Response for Shop Item
 * HTTP/1.1 201 Created
 * {
 *   "item": {
 *     "id": "52fdfc072182654f163f5f0f9a621d72",
 *     "name": "hoodie",
 *     "price": 15,
 *     "isRaffle": true
 *   }
 *  "quantity": {
 *      "id": "52fdfc072182654f163f5f0f9a621d72",
 *      "quantity:" 20
 *   }
 * }
 *
 * @apiUse strongVerifyErrors
 * @apiError (400: Bad Request) {String} InvalidParams Invalid item parameters provided.
 * @apiError (403: Forbidden) {String} InvalidPermission User does not have admin permissions.
 * @apiError (500: Internal Server Error) {String} InternalError An error occurred on the server.
 */
shopRouter.post("/", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;
    // Check if the token has staff permissions
    if (!hasStaffPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "InvalidPermission"));
    }

    // Convert item request into the item format
    const itemFormatString: string = req.body;
    const itemFormat: ItemFormat = JSON.parse(itemFormatString);
    if (itemFormat.itemId) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "ExtraIdProvided", { extraItemId: itemFormat.itemId }));
    }
    // Create the ID and process for this item
    const itemId: string = crypto.randomBytes(Config.SHOP_BYTES_GEN).toString("hex");
    itemFormat.itemId = itemId;
    //create and add new ShopItem and shopQuantity into database
    const item: ShopItem = new ShopItem(itemFormat.itemId, itemFormat.name, itemFormat.price, itemFormat.isRaffle);
    const quantity: ShopQuantity = new ShopQuantity(itemFormat.itemId, itemFormat.quantity);
    const newItem = await Models.ShopItem.create(item);
    const newQuantity = await Models.ShopQuantity.create(quantity);

    const responseObject = {
        item: newItem,
        quantity: newQuantity,
    };

    return res.status(StatusCode.SuccessCreated).send(responseObject);
});

/**
 * @api {delete} /shop/:ITEMID/ DELETE /shop/:ITEMID/
 * @apiGroup Shop
 * @apiDescription Delete an item by its unique ID.
 *
 * @apiHeader {String} Authorization User's JWT Token with admin permissions.
 *
 * @apiParam {String} ITEMID The unique identifier of the item to be deleted.
 *
 * @apiSuccess (204: No Content) NoContent Item deleted successfully.
 *
 * @apiUse strongVerifyErrors
 * @apiError (400: Bad Request) {String} InvalidParams Invalid item ID provided.
 * @apiError (403: Forbidden) {String} InvalidPermission User does not have admin permissions.
 * @apiError (500: Internal Server Error) {String} InternalError An error occurred on the server while deleting the item.
 */
shopRouter.delete("/:ITEMID/", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const itemId: string | undefined = req.params.ITEMID;

    // Check if request sender has permission to delete the item
    if (!hasStaffPerms(res.locals.payload as JwtPayload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "InvalidPermission"));
    }

    // Check if itemId field doesn't exist -> if not, returns error
    if (!itemId) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "InvalidParams"));
    }
    await Models.ShopItem.findOneAndDelete({ itemId: itemId });
    await Models.ShopQuantity.findOneAndDelete({ itemId: itemId });

    return res.status(StatusCode.SuccessNoContent).send({ status: "Success" });
});

/**
 * @api {put} /shop/quantity/ PUT /shop/quantity/
 * @apiGroup Shop
 * @apiDescription Update quantity for an item.
 *
 * @apiHeader {String} Authorization User's JWT Token with admin permissions.
 *
 * @apiBody (Request Body) {String} itemId The unique identifier of the item.
 * @apiBody (Request Body) {Boolean} quantity The new quantity of item.
 *
 * @apiSuccess (200: Success) {Json} quantity The updated quantity of the item.
 * @apiSuccessExample Example Success Response
 * HTTP/1.1 200 OK
 * {
 *   "itemId": "52fdfc072182654f163f5f0f9a621d72",
 *   "quantity": 5
 * }
 *
 * @apiUse strongVerifyErrors
 * @apiError (400: Bad Request) {String} InvalidParams Invalid request parameters.
 * @apiError (403: Forbidden) {String} InvalidPermission User does not have admin permissions.
 * @apiError (500: Internal Server Error) {String} InternalError An error occurred on the server while updating quantity.
 * @apiError (404: Not Found) {String} ItemNotFound Quantity for the given shop was not found
 */
shopRouter.put("/quantity/", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    if (!hasStaffPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "InvalidPermission"));
    }

    const quantityString: string = req.body;
    const quantity: QuantityFormat = JSON.parse(quantityString);
    const updatedQuantity: ShopQuantity | null = await Models.ShopQuantity.findOneAndUpdate(
        { itemId: quantity.itemId },
        { $set: { quantity: quantity.quantity } },
        { new: true },
    );

    if (!updatedQuantity) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "ItemNotFound"));
    }

    return res.status(StatusCode.SuccessOK).send(updatedQuantity);
});

/**
 * @api {put} /shop/item/ PUT /shop/item/
 * @apiGroup Shop
 * @apiDescription Update item attributes for an item.
 *
 * @apiHeader {String} Authorization User's JWT Token with admin permissions.
 *
 * @apiBody (Request Body) {String} itemId The unique identifier of the item.
 * @apiBody (Request Body) {Boolean} quantity The new item attributes of item.
 *
 * @apiSuccess (200: Success) {Json} item The updated item.
 * @apiSuccessExample Example Success Response
 * HTTP/1.1 200 OK
 * {
 *   "itemId": "52fdfc072182654f163f5f0f9a621d72",
 *   "name": "shoe",
 *   "price" : 20,
 *   "isRaffle": false
 * }
 *
 * @apiUse strongVerifyErrors
 * @apiError (400: Bad Request) {String} InvalidParams Invalid request parameters.
 * @apiError (403: Forbidden) {String} InvalidPermission User does not have admin permissions.
 * @apiError (500: Internal Server Error) {String} InternalError An error occurred on the server while updating item.
 * @apiError (404: Not Found) {String} ItemNotFound Item for the given shop was not found
 */
shopRouter.put("/item/", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;

    if (!hasStaffPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "InvalidPermission"));
    }
    const itemString: string = req.body;
    const item: ShopItemFormat = JSON.parse(itemString);
    const updatedItem: ShopItem | null = await Models.ShopItem.findOneAndUpdate(
        { itemId: item.itemId },
        { $set: { name: item.name, price: item.price, isRaffle: item.isRaffle } },
        { new: true },
    );
    if (!updatedItem) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "ItemNotFound"));
    }

    return res.status(StatusCode.SuccessOK).send(updatedItem);
});

export default shopRouter;
