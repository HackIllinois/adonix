import { Request, Response, Router } from "express";
import { NextFunction } from "express-serve-static-core";
import { weakJwtVerification, strongJwtVerification } from "../../middleware/verify-jwt.js";
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
    console.log("nesdkjfnjksfksdf");
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
 * @api {delete} /shop/item/:ITEMID DELETE /shop/item/:ITEMID
 * @apiGroup Shop
 * @apiDescription Delete the a specific item in the point shop based itemId.
 *
 * @apiSuccess (200: Success) {Json} success Indicates successful deletion of the user's profile.
 * @apiSuccessExample Example Success Response:
 * HTTP/1.1 200 OK
 * {
 *    "success": true
 * }
 * 
 * @apiError (500: Internal Error) {String} InternalError An internal server error occurred.
 * @apiErrorExample Example Error Response (InternalError):
 *     HTTP/1.1 500 Internal Server Error
 *     {"error": "InternalError"}
 */

shopRouter.delete("/item/:ITEMID", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    console.log("89");
    const targetItem: string | undefined = req.params.ITEMID as string;
    console.log("91");

    const shopItemDeleteResponse: DeleteResult = await Models.ShopItem.deleteOne({ itemId: targetItem });
    const shopQuantityDeleteResponse: DeleteResult = await Models.ShopQuantity.deleteOne({ itemId: targetItem });

    if (shopItemDeleteResponse.deletedCount == 0 || shopQuantityDeleteResponse.deletedCount == 0) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "ItemNotFound"));
    }
    return res.status(StatusCode.SuccessOK).send({ success: true });
});



export default shopRouter;
