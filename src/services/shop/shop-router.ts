import crypto from "crypto";
import Config from "../../config.js";
import { Request, Response, Router } from "express";
import { NextFunction } from "express-serve-static-core";
import { weakJwtVerification, strongJwtVerification } from "../../middleware/verify-jwt.js";
import { hasAdminPerms } from "../auth/auth-lib.js";
import { JwtPayload } from "../auth/auth-models.js";
import { getCoins, updateCoins } from "../profile/profile-lib.js";
import { getPrice } from "../shop/shop-lib.js";
import { DeleteResult } from "mongodb";
import { StatusCode } from "status-code-enum";
import { RouterError } from "../../middleware/error-handler.js";
import { ShopItemFormat, ItemFormat,  FilteredShopItemFormat } from "./shop-formats.js";
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
shopRouter.get("/", weakJwtVerification, async (_: Request, res: Response, _: NextFunction) => {
    const shopItems: ShopItemFormat[] = await Models.ShopItem.find();    
    
    const newData: FilteredShopItemFormat = shopItems.map((item: ShopItemFormat) => {
        return 
    });
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
 *      "quantity": 1,
 *      "imageURL": "https://raw.githubusercontent.com/HackIllinois/example/avatars/bunny.svg"
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
 *      "quantity": 1,
 *      "imageURL": "https://raw.githubusercontent.com/HackIllinois/example/avatars/bunny.svg"
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

    const itemId = "item" + parseInt(crypto.randomBytes(Config.SHOP_BYTES_GEN).toString("hex"), 16);

    const metaItem: ItemFormat = req.body as ItemFormat;
    metaItem.itemId = itemId;

    const shopItem: ShopItemFormat = {
        itemId: itemId,
        name: req.body.name,
        price: req.body.price,
        isRaffle: req.body.isRaffle,
        imageURL: req.body.imageURL,
    };

    const uniqueSecrets = new Set<number>();
    while (uniqueSecrets.size < req.body.quantity) {
        uniqueSecrets.add(getRand());
    }
    const secrets = Array.from(uniqueSecrets);

    const itemQuantity: QuantityFormat = {
        itemId: itemId,
        quantity: req.body.quantity,
        secrets: secrets,
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
 * @api {put} /shop/item/:ITEMID PUT /shop/item/:ITEMID
 * @apiGroup Shop
 * @apiDescription Update fields of an existing item in the shop.
 * @apiBody {String} eventId The id of the event to follow.
 * @apiParamExample {json} Request Example:
 *     {
 *       "name": "HackIllinois Branded Hoodie",
 *       "price": 1000000,
 *       "isRaffle": false,
 *       "imageURL": "https://raw.githubusercontent.com/HackIllinois/example/avatars/bunny.svg"
 *     }
 * @apiSuccess (200: Success) {String} Item upon performing updates.
 * @apiSuccessExample {json} Success Response:
 *	{
 *      "itemId": "item01",
 *      "name": "HackIllinois Branded Hoodie",
 *      "price": 1000000,
 *      "isRaffle": false,
 *      "quantity": 1,
 *      "imageURL": "https://raw.githubusercontent.com/HackIllinois/example/avatars/bunny.svg"
 * }
 * @apiUse strongVerifyErrors
 * @apiError (400: Bad Request) {String} ItemInRequestBody Omit itemId from request body.
 * @apiError (403: Forbidden) {String} InvalidPermission User does not have admin permissions.
 * @apiError (404: Not Found) {String} ItemNotFound Item with itemId not found.
 * @apiError (500: Internal Server Error) {String} InternalError An error occurred on the server.
 */
shopRouter.put("/item/:ITEMID", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const payload: JwtPayload = res.locals.payload as JwtPayload;
    const targetItem: string | undefined = req.params.ITEMID as string;

    // Check if the token has admin permissions
    if (!hasAdminPerms(payload)) {
        return next(new RouterError(StatusCode.ClientErrorForbidden, "InvalidPermission"));
    }

    if (req.body.itemId) {
        return next(new RouterError(StatusCode.ClientErrorBadRequest, "ItemInRequestBody"));
    }

    const itemExists: boolean = (await Models.ShopItem.findOne({ itemId: targetItem })) ?? false;
    if (!itemExists) {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "ItemNotFound"));
    }

    await Models.ShopItem.findOneAndUpdate(
        { itemId: targetItem },
        { name: req.body.name, price: req.body.price, isRaffle: req.body.isRaffle, imageURL: req.body.imageURL },
        { new: true },
    );

    return res.status(StatusCode.SuccessOK).send({ success: true });
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

/**
 * @api {get} /shop/item/qr/:ITEMID/ GET /shop/item/qr/:ITEMID/
 * @apiGroup Shop
 * @apiDescription Get a QR code of quantity number of items.
 *
 * @apiParam {String} ITEMID Id to generate the QR code for.
 *
 * @apiSuccess (200: Success) {String} itemId Item to generate a QR code for
 * @apiSuccess (200: Success) {String} qrInfo Array of stringified QR codes for the requested item 

 * @apiSuccessExample Example Success Response:
 * 	HTTP/1.1 200 OK
 *	{
 *		"itemId": "item0001",
 * 		"qrInfo": [
            "hackillinois://item?itemId=item49289&secret=4",
            "hackillinois://item?itemId=item49289&secret=73",
            "hackillinois://item?itemId=item49289&secret=69"
        ]
 * 	}
 *
 * @apiError (404: Not Found) {String} ItemNotFound Item doesn't exist in the database.
 * @apiUse strongVerifyErrors
 */
shopRouter.get("/item/qr/:ITEMID", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const targetItem: string | undefined = req.params.ITEMID as string;

    // Obtain secrets generating when initializing items
    let secrets: number[] = [];
    const obj = await Models.ShopQuantity.findOne({ itemId: targetItem });
    if (obj) {
        secrets = obj.secrets;
    } else {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "ItemNotFound"));
    }

    // Generate array of uris representing all unique items
    const uris: string[] = [];
    for (let i = 0; i < secrets.length; i++) {
        console.log(secrets[i]);
        uris.push(`hackillinois://item?itemId=${targetItem}&secret=${secrets[i]}`);
    }
    return res.status(StatusCode.SuccessOK).send({ itemId: targetItem, qrInfo: uris });
});

/**
 * @api {post} /shop/item/buy/:ITEMID/ GET /shop/item/buy/:ITEMID/
 * @apiGroup Shop
 * @apiDescription Purchase item at the point shop using provided QR code.
 *
 * @apiHeader {String} Authorization User's JWT Token with attendee permissions.
 *
 * @apiBody {Json} itemId ItemId of item being purchased.
 * @apiBody {Json} secret Secret provided by uri to uniquely identify the item.
 * @apiParamExample {Json} Request Body Example for an Item:
 * {
 *      "itemId": "item0001",
 *      "secret": 15,
 * }
 *
 * @apiUse strongVerifyErrors
 * @apiError (200: Success) {String} Success Purchase was successful.
 * @apiError (403: Forbidden) {String} InvalidPermission User does not have attendee permissions.
 * @apiError (404: Not Found) {String} ItemNotFound Item with itemId not found or already purchased.
 * @apiError (404: Not Found) {String} InvalidUniqueItem This unique item is already purchased or doesn't exist.
 * @apiError (500: Internal Server Error) {String} InternalError An error occurred on the server.
 */
shopRouter.post("/item/buy", strongJwtVerification, async (req: Request, res: Response, next: NextFunction) => {
    const itemId: string | undefined = req.body.itemId as string;
    const payload: JwtPayload = res.locals.payload as JwtPayload;
    const userId: string = payload.id;

    let secrets: number[] = [];
    const obj = await Models.ShopQuantity.findOne({ itemId: itemId });
    if (obj) {
        secrets = obj.secrets;
    } else {
        return next(new RouterError(StatusCode.ClientErrorNotFound, "ItemNotFound"));
    }

    const targetItem = await Models.ShopItem.findOne({ itemId: itemId });

    for (let i = 0; i < secrets.length; ++i) {
        if (secrets[i] == req.body.secret) {
            // check for insufficient funds
            if (getCoins(userId) < getPrice(itemId)) {
                return next(new RouterError(StatusCode.ClientErrorBadRequest, "InsufficientFunds"));
            } else {
                // delete shop item
                const updatedShopQuantity = await Models.ShopQuantity.updateOne(
                    { itemId: itemId },
                    {
                        $inc: { quantity: -1 },
                        $pull: { secrets: req.body.secret },
                    },
                );

                // decrement attendee coins
                if (updatedShopQuantity) {
                    if (targetItem) {
                        updateCoins(userId, -targetItem.price);
                    }
                    return res.status(StatusCode.SuccessOK).send({ success: true });
                }
            }
        }
    }

    return next(new RouterError(StatusCode.ClientErrorNotFound, "InvalidUniqueItem"));
});

// TODO: Hash this!!!
function getRand(): string {
    const index = Math.floor(Math.random() * Config.MAX_SHOP_STOCK_PER_ITEM);
    const hash = crypto.createHash('sha256').update(`${Config.JWT_SECRET}|${index}`).digest("hex");
    return hash;
}

export default shopRouter;
