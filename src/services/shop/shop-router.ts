import { Request, Response, Router } from "express";
import { NextFunction } from "express-serve-static-core";
import { weakJwtVerification } from "../../middleware/verify-jwt.js";
import { StatusCode } from "status-code-enum";
// import { RouterError } from "../../middleware/error-handler.js";
// import { ItemFormat, QuantityFormat, ShopItemFormat } from "./shop-formats.js";
// import Models from "../../database/models.js";

const shopRouter: Router = Router();
// shopRouter.get("/", weakJwtVerification, async (_: Request, res: Response, next: NextFunction) => {
//     try {
//         const shopItems: ShopItemFormat[] = await Models.ShopItem.find();
//         const shopQuantities: QuantityFormat[] = await Models.ShopQuantity.find();

//         const itemsMap = new Map<string, ShopItemFormat>();
//         shopItems.forEach((item) => {
//             return itemsMap.set(item.itemId, item);
//         });

//         const itemsWithQuantity: ItemFormat[] = Array.from(itemsMap.values()).map((item) => {
//             const quantity = shopQuantities.find((q) => {
//                 return q.itemId === item.itemId;
//             });
//             const itemQuantity = quantity ? quantity.quantity : 0;

//             return {
//                 itemId: item.itemId,
//                 name: item.name || "",
//                 price: item.price || 0,
//                 isRaffle: item.isRaffle || false,
//                 quantity: itemQuantity,
//             };
//         });

//         return res.status(StatusCode.SuccessOK).send(itemsWithQuantity);
//     } catch (error) {
//         console.error(error);
//         return next(new RouterError(StatusCode.ServerErrorInternal, "InternalServerError"));
//     }
// });

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
 *      "isRaffle": true,
 *      "quantity": 20
 *   }, {
 *      "name": "shoe",
 *      "price": 20,
 *      "isRaffle": false,
 *      "quantity": 1
 *   }]
 * }
 *
 * @apiUse weakJwtVerification
 * */
shopRouter.get("/", weakJwtVerification, async (_1: Request, res: Response, _2: NextFunction) => {
    const data = [
        {
            itemId: "0x1218907123897312891",
            name: "sticker",
            price: 15,
            isRaffle: true,
            quantity: 20,
        },
        {
            itemId: "0x1218907123897312892",
            name: "shoes",
            price: 20,
            isRaffle: false,
            quantity: 1,
        },
    ];
    return res.status(StatusCode.SuccessOK).send(data);
});

export default shopRouter;
